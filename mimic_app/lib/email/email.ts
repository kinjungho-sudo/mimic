import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM_EMAIL ?? '포리 <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const firstName = name.split(' ')[0] || name;
  const dashboardUrl = `${APP_URL}/home`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${firstName}님, 포리에 오신 걸 환영합니다 🎉`,
    html: `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>포리 가입을 환영합니다</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Pretendard',sans-serif">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,0.10)">

        <!-- 헤더 그라데이션 -->
        <tr><td style="background:linear-gradient(135deg,#3730a3 0%,#6d28d9 100%);padding:48px 40px 40px;text-align:center;position:relative">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px">
            <tr><td style="width:64px;height:64px;background:rgba(255,255,255,0.18);border-radius:18px;text-align:center;vertical-align:middle;border:1.5px solid rgba(255,255,255,0.25)">
              <img src="${APP_URL}/mimic-logo.png" width="44" height="44" alt="포리" style="display:block;margin:10px auto;border:0" />
            </td></tr>
          </table>
          <p style="margin:0;font-size:28px;font-weight:800;color:white;letter-spacing:-0.03em;line-height:1">포리</p>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.10em;text-transform:uppercase">기억은 포켓에, 실행은 화면 위에.</p>
        </td></tr>

        <!-- 환영 섹션 -->
        <tr><td style="padding:48px 48px 0;text-align:center">
          <p style="margin:0 0 12px;font-size:30px">🎉</p>
          <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0F172A;letter-spacing:-0.025em;line-height:1.25">
            환영합니다, ${firstName}님!
          </h1>
          <p style="margin:0 0 32px;font-size:15px;color:#6B7280;line-height:1.75;max-width:400px;margin-left:auto;margin-right:auto">
            포리 가입을 축하드립니다.<br>
            이제 30초 만에 인터랙티브 매뉴얼을 만들 수 있습니다.
          </p>
        </td></tr>

        <!-- 기능 카드 3개 -->
        <tr><td style="padding:0 40px 40px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <!-- 카드 1 -->
              <td width="33%" style="padding:0 6px;vertical-align:top">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border-radius:16px;overflow:hidden">
                  <tr><td style="padding:24px 20px;text-align:center">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg,#3730a3,#6d28d9);border-radius:12px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center">
                      <img src="https://em-content.zobj.net/source/microsoft-teams/363/video-camera_1f4f9.png" width="24" height="24" alt="" style="display:block;margin:10px auto" />
                    </div>
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1E1B4B;letter-spacing:-0.01em">화면 녹화</p>
                    <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.6">Chrome 확장으로<br>평소처럼 작업</p>
                  </td></tr>
                </table>
              </td>
              <!-- 카드 2 -->
              <td width="33%" style="padding:0 6px;vertical-align:top">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border-radius:16px;overflow:hidden">
                  <tr><td style="padding:24px 20px;text-align:center">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg,#3730a3,#6d28d9);border-radius:12px;margin:0 auto 14px">
                      <img src="https://em-content.zobj.net/source/microsoft-teams/363/magic-wand_1fa84.png" width="24" height="24" alt="" style="display:block;margin:10px auto" />
                    </div>
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1E1B4B;letter-spacing:-0.01em">AI 자동 변환</p>
                    <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.6">가이드·튜토리얼·<br>영상으로 자동 생성</p>
                  </td></tr>
                </table>
              </td>
              <!-- 카드 3 -->
              <td width="33%" style="padding:0 6px;vertical-align:top">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;border-radius:16px;overflow:hidden">
                  <tr><td style="padding:24px 20px;text-align:center">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg,#3730a3,#6d28d9);border-radius:12px;margin:0 auto 14px">
                      <img src="https://em-content.zobj.net/source/microsoft-teams/363/link_1f517.png" width="24" height="24" alt="" style="display:block;margin:10px auto" />
                    </div>
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1E1B4B;letter-spacing:-0.01em">링크 공유</p>
                    <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.6">링크 한 줄로<br>어디서든 공유</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- 무료 플랜 혜택 안내 -->
        <tr><td style="padding:0 48px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border-radius:16px;border-left:4px solid #10B981">
            <tr><td style="padding:20px 24px">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#065F46;letter-spacing:-0.01em">✅ 무료 플랜으로 바로 시작하세요</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="padding:3px 0;font-size:13px;color:#374151">
                  <span style="color:#10B981;font-weight:600;margin-right:8px">·</span>매일 매뉴얼 3개 무료 생성
                </td></tr>
                <tr><td style="padding:3px 0;font-size:13px;color:#374151">
                  <span style="color:#10B981;font-weight:600;margin-right:8px">·</span>포리 Recorder Chrome 확장 무료 설치
                </td></tr>
                <tr><td style="padding:3px 0;font-size:13px;color:#374151">
                  <span style="color:#10B981;font-weight:600;margin-right:8px">·</span>링크 공유 · PDF 내보내기 무제한
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA 버튼 -->
        <tr><td style="padding:0 48px 48px;text-align:center">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto">
            <tr><td style="background:linear-gradient(135deg,#3730a3 0%,#6d28d9 100%);border-radius:14px;box-shadow:0 8px 24px rgba(55,48,163,0.35)">
              <a href="${dashboardUrl}" style="display:block;padding:17px 44px;color:white;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:-0.01em;white-space:nowrap">
                첫 매뉴얼 만들러 가기 &rarr;
              </a>
            </td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:12.5px;color:#9CA3AF">버튼이 작동하지 않으면 아래 링크를 복사하세요<br>
            <a href="${dashboardUrl}" style="color:#3730a3;text-decoration:none;font-size:12px">${dashboardUrl}</a>
          </p>
        </td></tr>

        <!-- 구분선 -->
        <tr><td style="padding:0 48px"><div style="height:1px;background:#F3F4F6"></div></td></tr>

        <!-- 푸터 -->
        <tr><td style="padding:28px 48px 32px;text-align:center">
          <p style="margin:0 0 6px;font-size:14px;font-weight:800;color:#3730a3;letter-spacing:-0.02em">포리</p>
          <p style="margin:0 0 12px;font-size:12px;color:#9CA3AF;line-height:1.7">
            매뉴얼을 더 쉽고 빠르게 · © 2026 코마인드웍스<br>
            궁금한 점은 <a href="mailto:kinjungho@gmail.com" style="color:#3730a3;text-decoration:none">kinjungho@gmail.com</a>으로 문의해주세요.
          </p>
          <p style="margin:0;font-size:11px;color:#D1D5DB">
            이 이메일은 ${to} 계정의 포리 가입을 기념하여 발송됐습니다.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`,
  });
}

export async function sendManualShareInvitation({
  to,
  inviterName,
  manualTitle,
  role,
  url,
}: {
  to: string;
  inviterName: string;
  manualTitle: string;
  role: 'viewer' | 'editor';
  url: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const roleLabel = role === 'editor' ? '편집' : '보기';

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName}님이 '${manualTitle}' 매뉴얼을 공유했습니다`,
    html: `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F0F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10)">
        <tr><td style="background:linear-gradient(135deg,#3730a3 0%,#6d28d9 100%);padding:36px 40px;text-align:center">
          <p style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.03em;line-height:1">포리</p>
        </td></tr>
        <tr><td style="padding:40px 48px 36px;text-align:center">
          <p style="margin:0 0 10px;font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.02em">매뉴얼 공유</p>
          <p style="margin:0 0 28px;font-size:15px;color:#6B7280;line-height:1.7">
            <strong style="color:#111827">${inviterName}</strong>님이<br>
            <strong style="color:#3730a3;font-size:16px">${manualTitle}</strong> 매뉴얼을<br>
            <strong style="color:#111827">${roleLabel}</strong> 권한으로 공유했습니다.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">
            <tr><td style="background:linear-gradient(135deg,#3730a3,#6d28d9);border-radius:12px">
              <a href="${url}" style="display:block;padding:15px 36px;color:white;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.01em">매뉴얼 열기 &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12.5px;color:#9CA3AF;line-height:1.8">
            포리 계정(${to})으로 로그인하면 접근할 수 있습니다.
          </p>
        </td></tr>
        <tr><td style="padding:0 48px"><div style="height:1px;background:#F3F4F6"></div></td></tr>
        <tr><td style="padding:24px 48px 28px;text-align:center">
          <p style="margin:0;font-size:11.5px;color:#9CA3AF">매뉴얼을 더 쉽고 빠르게 · © 2026 포리</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendWorkspaceInvitation({
  to,
  inviterName,
  workspaceName,
  role,
  token,
}: {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  token: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const acceptUrl = `${APP_URL}/workspace/invite/${token}`;
  const roleLabel = role === 'admin' ? '관리자' : role === 'editor' ? '편집자' : '뷰어';

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName}님이 '${workspaceName}' 워크스페이스에 초대했습니다`,
    html: `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F0F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10)">

        <!-- 헤더: 그라데이션 + 로고 -->
        <tr><td style="background:linear-gradient(135deg,#3730a3 0%,#6d28d9 100%);padding:40px 40px 36px;text-align:center">
          <!-- 로고 아이콘 박스 -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px">
            <tr><td style="width:56px;height:56px;background:rgba(255,255,255,0.18);border-radius:14px;text-align:center;vertical-align:middle">
              <img src="${APP_URL}/mimic-logo.png" width="40" height="40" alt="포리" style="display:block;margin:8px auto;border:0" />
            </td></tr>
          </table>
          <!-- 브랜드명 -->
          <p style="margin:0;font-size:26px;font-weight:800;color:white;letter-spacing:-0.03em;line-height:1">포리</p>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.08em;text-transform:uppercase">Manual · Made Simple</p>
        </td></tr>

        <!-- 본문 -->
        <tr><td style="padding:44px 48px 36px;text-align:center">
          <!-- 워크스페이스 아이콘 -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td style="width:52px;height:52px;background:#e0e7ff;border-radius:14px;text-align:center;vertical-align:middle">
              <img src="https://em-content.zobj.net/source/microsoft-teams/363/busts-in-silhouette_1f465.png" width="28" height="28" alt="" style="display:block;margin:12px auto;border:0" />
            </td></tr>
          </table>

          <p style="margin:0 0 10px;font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-0.02em">팀 워크스페이스 초대</p>
          <p style="margin:0 0 28px;font-size:15px;color:#6B7280;line-height:1.7">
            <strong style="color:#111827">${inviterName}</strong>님이<br>
            <strong style="color:#3730a3;font-size:16px">${workspaceName}</strong> 워크스페이스에<br>
            <strong style="color:#111827">${roleLabel}</strong> 권한으로 초대했습니다.
          </p>

          <!-- 수락 버튼 -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px">
            <tr><td style="background:linear-gradient(135deg,#3730a3,#6d28d9);border-radius:12px">
              <a href="${acceptUrl}" style="display:block;padding:15px 36px;color:white;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.01em">
                초대 수락하기 &rarr;
              </a>
            </td></tr>
          </table>

          <!-- 유효기간 안내 -->
          <p style="margin:0;font-size:12.5px;color:#9CA3AF;line-height:1.8">
            이 링크는 <strong style="color:#6B7280">7일간</strong> 유효합니다.<br>
            초대를 원하지 않으면 무시하셔도 됩니다.
          </p>
        </td></tr>

        <!-- 구분선 -->
        <tr><td style="padding:0 48px"><div style="height:1px;background:#F3F4F6"></div></td></tr>

        <!-- 푸터 -->
        <tr><td style="padding:24px 48px 28px;text-align:center">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#3730a3;letter-spacing:-0.01em">포리</p>
          <p style="margin:0;font-size:11.5px;color:#9CA3AF">매뉴얼을 더 쉽고 빠르게 · © 2025 포리</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
