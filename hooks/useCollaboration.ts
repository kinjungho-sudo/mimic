'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ManualStep } from '@/components/editor/ManualEditor';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Collaborator = {
  userId: string;
  name: string;
  color: string;
  activeStepId: string | null;
};

type CollaborationOptions = {
  tutorialId: string;
  workspaceId: string | null;       // null이면 개인 튜토리얼 — 협업 미활성
  currentUser: { id: string; name: string } | null;
  steps: ManualStep[];
  onRemoteStepChange: (stepId: string, patch: Partial<ManualStep>) => void;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
};

// 사용자별 고유 색상 (최대 8명)
const COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'];
function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function useCollaboration({
  tutorialId,
  workspaceId,
  currentUser,
  steps,
  onRemoteStepChange,
  onCollaboratorsChange,
}: CollaborationOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // 원격 step 변경을 브로드캐스트
  const broadcastStepChange = useCallback((stepId: string, patch: Partial<ManualStep>) => {
    if (!channelRef.current || !workspaceId) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'step_change',
      payload: { stepId, patch, userId: currentUser?.id },
    });
  }, [workspaceId, currentUser?.id]);

  // 현재 활성 스텝 변경을 Presence로 전송
  const updatePresence = useCallback((activeStepId: string | null) => {
    if (!channelRef.current || !currentUser || !workspaceId) return;
    channelRef.current.track({
      userId: currentUser.id,
      name: currentUser.name,
      color: userColor(currentUser.id),
      activeStepId,
    });
  }, [workspaceId, currentUser]);

  useEffect(() => {
    // 워크스페이스 튜토리얼이 아니면 협업 채널 불필요
    if (!workspaceId || !currentUser || !tutorialId) return;

    const supabase = createClient();
    const channelName = `tutorial:${tutorialId}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUser.id } },
    });

    channel
      // 다른 편집자의 step 변경 수신
      .on('broadcast', { event: 'step_change' }, ({ payload }) => {
        const { stepId, patch, userId } = payload as {
          stepId: string;
          patch: Partial<ManualStep>;
          userId: string;
        };
        // 자신이 보낸 변경은 무시
        if (userId === currentUser.id) return;
        onRemoteStepChange(stepId, patch);
      })
      // Presence: 접속자 목록 변경
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<Collaborator>();
        const collaborators: Collaborator[] = Object.values(state)
          .flat()
          .filter(p => p.userId !== currentUser.id);
        onCollaboratorsChange(collaborators);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState<Collaborator>();
        const collaborators: Collaborator[] = Object.values(state)
          .flat()
          .filter(p => p.userId !== currentUser.id);
        onCollaboratorsChange(collaborators);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.id,
            name: currentUser.name,
            color: userColor(currentUser.id),
            activeStepId: null,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  // currentUser.id/name, tutorialId, workspaceId가 바뀔 때만 재구독
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialId, workspaceId, currentUser?.id]);

  return { broadcastStepChange, updatePresence };
}
