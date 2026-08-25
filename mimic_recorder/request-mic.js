// 마이크 권한 요청 페이지 — 일반 확장 페이지(창)에서 getUserMedia를 호출해야
// Chrome이 마이크 프롬프트를 정상적으로 띄운다. 사이드패널·offscreen은 프롬프트를
// 띄우지 못하고 즉시 거부되기 때문. 허용되면 확장 오리진 전체에 권한이 저장되어
// 이후 offscreen 문서의 녹음이 동작한다.

const iconEl  = document.getElementById('icon');
const titleEl = document.getElementById('title');
const descEl  = document.getElementById('desc');
const hintEl  = document.getElementById('hint');
const retryBtn = document.getElementById('retryBtn');

async function requestMic() {
  iconEl.textContent = '🎙️';
  titleEl.textContent = '마이크 권한을 요청하는 중…';
  titleEl.className = 'title';
  descEl.innerHTML = '브라우저 상단에 뜨는 <strong>마이크 허용</strong> 창에서 “허용”을 눌러주세요.';
  hintEl.classList.remove('show');
  retryBtn.style.display = 'none';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());  // 권한만 획득, 즉시 해제
    await chrome.storage.local.set({ micPermissionGranted: true });
    iconEl.textContent = '✅';
    titleEl.textContent = '마이크 권한이 허용되었습니다';
    titleEl.className = 'title ok';
    descEl.textContent = '잠시 후 이 창이 자동으로 닫힙니다.';
    setTimeout(() => window.close(), 1300);
  } catch (err) {
    await chrome.storage.local.set({ micPermissionGranted: false });
    iconEl.textContent = '🚫';
    titleEl.textContent = '마이크 권한이 거부되었습니다';
    titleEl.className = 'title err';
    descEl.textContent = '음성 설명 녹음을 사용하려면 마이크 권한이 필요합니다.';
    hintEl.innerHTML =
      '이미 차단하셨다면 직접 풀어주세요:<br>' +
      '1) 주소창 왼쪽 <strong>자물쇠/사이트 정보</strong> 아이콘 클릭<br>' +
      '2) <strong>마이크</strong>를 “허용”으로 변경<br>' +
      '3) 아래 “다시 시도”를 누르거나 이 창을 닫고 다시 켜기';
    hintEl.classList.add('show');
    retryBtn.style.display = 'inline-block';
  }
}

retryBtn.addEventListener('click', requestMic);
requestMic();
