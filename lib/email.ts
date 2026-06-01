import { Resend } from 'resend';

const FROM = 'MIMIC <noreply@mimicmanual.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)">
        <!-- 헤더 -->
        <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px 40px;text-align:center">
          <div style="display:inline-flex;align-items:center;gap:8px">
            <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;vertical-align:middle;text-align:center;line-height:32px">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" style="vertical-align:middle">
                <rect x="3.2" y="5.2" width="11" height="2.4" rx="1.2" fill="white" fill-opacity="0.5"/>
                <rect x="3.2" y="10.8" width="14" height="2.4" rx="1.2" fill="white"/>
                <rect x="3.2" y="16.4" width="8" height="2.4" rx="1.2" fill="white" fill-opacity="0.5"/>
                <circle cx="18.7" cy="17.6" r="3.6" fill="white"/>
                <path d="M17.6 16.1 L20.1 17.6 L17.6 19.1 Z" fill="#4F46E5"/>
              </svg>
            </div>
            <span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.02em">MIMIC</span>
          </div>
        </td></tr>
        <!-- 본문 -->
        <tr><td style="padding:40px">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A">팀 워크스페이스 초대</p>
          <p style="margin:0 0 28px;font-size:15px;color:#6B7280;line-height:1.6">
            <strong style="color:#111827">${inviterName}</strong>님이
            <strong style="color:#4F46E5">${workspaceName}</strong> 워크스페이스에
            <strong style="color:#111827">${roleLabel}</strong> 권한으로 초대했습니다.
          </p>
          <a href="${acceptUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">
            초대 수락하기 →
          </a>
          <p style="margin:28px 0 0;font-size:12px;color:#9CA3AF;line-height:1.6">
            이 링크는 7일간 유효합니다.<br>
            초대를 원하지 않으면 무시하셔도 됩니다.
          </p>
        </td></tr>
        <!-- 푸터 -->
        <tr><td style="padding:20px 40px;border-top:1px solid #F3F4F6;text-align:center">
          <p style="margin:0;font-size:12px;color:#9CA3AF">© MIMIC · 매뉴얼을 더 쉽게</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
