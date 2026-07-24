export const LEGAL_ENGLISH_TRANSLATIONS: Record<string, string> = {
  '개인정보 처리방침': 'Privacy Policy',
  'Parro 서비스의 개인정보 수집·이용·보관 및 파기에 관한 방침을 안내합니다.':
    'This policy explains how the Parro service collects, uses, retains, and destroys personal information.',
  '최종 수정일: 2026년 7월 16일 · 시행일: 2026년 7월 16일':
    'Last updated: July 16, 2026 · Effective date: July 16, 2026',
  '이 방침은 Parro 웹 서비스와 Chrome 확장 프로그램':
    'This policy applies to the Parro web service and the Chrome extension',
  '에 적용됩니다. Parro Recorder의 화면·웹 활동 수집 범위와 처리 방법은 아래 제3조와 제4조에서 확인할 수 있습니다.':
    '. The scope of screen and web activity collected by Parro Recorder and how that information is processed are described in Articles 3 and 4 below.',
  '제1조 (개인정보의 처리 목적)': 'Article 1 (Purposes of Processing Personal Information)',
  '코마인드웍스(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다. (1) 서비스 제공: 매뉴얼 제작, 공유, 플레이어 기능 제공, (2) 회원 관리: 회원제 서비스 이용에 따른 본인 확인, 개인 식별, 불량회원의 부정 이용 방지, (3) 마케팅 및 광고 활용 (동의한 경우에 한함): 이벤트 및 광고성 정보 제공.':
    'Comindworks (hereinafter, the "Company") processes personal information for the following purposes. Personal information being processed will not be used for any purpose other than those stated below. If a purpose of use changes, the Company will take necessary measures, such as obtaining separate consent, in accordance with Article 18 of the Personal Information Protection Act. (1) Provision of services: creating and sharing manuals and providing player features; (2) Member management: identity verification and personal identification in connection with membership services, and prevention of unauthorized use by members in violation of the rules; (3) Marketing and advertising (only where consent has been given): providing information about events and promotional communications.',
  '제2조 (처리하는 개인정보의 항목)': 'Article 2 (Categories of Personal Information Processed)',
  '회사는 다음의 개인정보 항목을 처리하고 있습니다. [필수] 이메일 주소, 이름(닉네임), 프로필 이미지(Google 연동 시). [자동 수집] 서비스 이용 기록, 접속 로그, IP 주소, 쿠키, 기기 정보. [선택] 마케팅 수신 동의 여부.':
    'The Company processes the following categories of personal information. [Required] Email address, name (nickname), and profile image (when linked to Google). [Collected automatically] Service usage records, access logs, IP address, cookies, and device information. [Optional] Whether the user has consented to receive marketing communications.',
  '제3조 (Parro Recorder가 처리하는 정보)': 'Article 3 (Information Processed by Parro Recorder)',
  'Parro Recorder는 사용자가 직접 녹화를 시작한 동안에만 다음 정보를 처리합니다. (1) 선택한 탭·창·화면의 스크린샷, (2) 녹화 중인 페이지의 URL과 제목, (3) 클릭한 요소의 정보, 선택자, 좌표와 시각, 페이지 이동 등 사용자 활동, (4) 매뉴얼 단계 생성에 필요한 일반 입력 내용 및 입력 화면. 비밀번호 입력란과 비밀번호로 식별되는 필드의 값은 저장하지 않습니다. 입력 내용은 캡처 화면에 보일 수 있으므로 민감정보가 있는 페이지는 녹화하지 않거나 제공되는 블러 기능을 사용해야 합니다. 사용자가 음성 설명 기능을 켜고 마이크 권한을 허용한 경우에만 마이크 음성을 처리합니다. 확장 프로그램과 Parro 계정을 연결하기 위한 세션 토큰, 계정 식별자 및 확장 프로그램 설정도 처리합니다. 데스크톱 캡처 기능을 사용하는 경우 사용자가 선택한 데스크톱 화면과 동작 정보가 동일한 목적으로 처리됩니다.':
    'Parro Recorder processes the following information only while the user has directly started a recording: (1) screenshots of the selected tab, window, or screen; (2) the URL and title of the page being recorded; (3) information about clicked elements, selectors, coordinates and timestamps, page navigation, and other user activity; and (4) ordinary input content and input screens needed to create manual steps. Values entered in password fields and fields identified as password fields are not stored. Because entered content may appear in captured screens, users must not record pages containing sensitive information or must use the provided blur feature. Microphone audio is processed only when the user enables voice narration and grants microphone permission. Session tokens, account identifiers, and extension settings used to connect the extension to a Parro account are also processed. When the desktop capture feature is used, the desktop screen selected by the user and information about user actions are processed for the same purposes.',
  '제4조 (Parro Recorder 정보의 이용·저장·전송)':
    'Article 4 (Use, Storage, and Transmission of Parro Recorder Information)',
  '회사는 Recorder가 수집한 정보를 단계별 매뉴얼 생성, AI 제목·설명 생성, 선택적 음성 전사·합성, Live Guide 대상 요소 식별 및 사용자가 요청한 서비스 제공에만 사용합니다. 녹화 단계와 전송 전 임시 데이터, 계정 연동 토큰 및 설정은 chrome.storage.local 등 사용자 기기에 저장될 수 있습니다. 캡처 이미지·음성·단계 정보는 HTTPS를 통해 Parro 서버와 Supabase 저장소로 전송되며, AI 처리에 필요한 최소 범위의 데이터는 Anthropic 및 OpenAI에 전송됩니다. 수집한 데이터를 판매하거나 맞춤형·리타게팅 광고에 사용하지 않습니다. 사용자의 명시적 동의, 보안 조사 또는 법적 의무 등 허용된 경우를 제외하고 사람이 사용자 데이터를 읽도록 허용하지 않습니다.':
    'The Company uses information collected by Recorder only to create step-by-step manuals, generate AI titles and descriptions, provide optional voice transcription and synthesis, identify target elements for Live Guide, and provide services requested by the user. Recording steps, temporary data before transmission, account-linking tokens, and settings may be stored on the user’s device, including in chrome.storage.local. Captured images, audio, and step information are transmitted over HTTPS to Parro servers and Supabase storage. The minimum data necessary for AI processing is transmitted to Anthropic and OpenAI. The Company does not sell collected data or use it for personalized or retargeted advertising. The Company does not permit people to read user data except where allowed, such as with the user’s explicit consent, for a security investigation, or to comply with a legal obligation.',
  '제5조 (개인정보의 처리 및 보유기간)': 'Article 5 (Processing and Retention Period)',
  '회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다. 회원 탈퇴 또는 삭제 요청 시 지체없이 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우 해당 기간 동안 보존합니다. Recorder의 녹화 완료 또는 취소 후 전송 전 로컬 임시 데이터는 삭제하며, 계정 연동 토큰과 설정은 사용자가 연동을 해제하거나 확장 프로그램 데이터를 삭제할 때까지 기기에 보관될 수 있습니다.':
    'The Company processes and retains personal information for the retention and use period required by law or for the period to which the data subject consented when the personal information was collected. Personal information is destroyed without delay when a member withdraws or requests deletion. However, if retention is required by applicable law, it is retained for the period required by that law. After a Recorder recording is completed or canceled, local temporary data that has not been transmitted is deleted. Account-linking tokens and settings may remain on the device until the user disconnects the account or deletes the extension data.',
  '제6조 (개인정보의 제3자 제공)': 'Article 6 (Provision of Personal Information to Third Parties)',
  '회사는 정보주체의 개인정보를 제1조와 제4조에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조에 해당하는 경우를 제외하고 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 서비스 제공에 필요한 수탁업체의 처리는 제7조에 따릅니다.':
    'The Company processes the data subject’s personal information only within the scope specified in Articles 1 and 4 and does not sell or provide personal information to third parties except in cases falling under Article 17 of the Personal Information Protection Act, such as with the data subject’s consent or where specifically permitted by law. Processing by service providers necessary to provide the service is governed by Article 7.',
  '제7조 (개인정보처리의 위탁)': 'Article 7 (Outsourcing of Personal Information Processing)',
  '회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다. Supabase Inc. — 데이터베이스, 인증 및 파일 저장 서비스 운영, Google LLC — OAuth 인증 서비스, Vercel Inc. — 서비스 호스팅 및 배포, Anthropic PBC — AI 이미지 분석 및 텍스트 생성, OpenAI — 음성 전사 및 음성 합성 서비스.':
    'The Company outsources personal information processing as follows to provide the service: Supabase Inc. — operation of database, authentication, and file storage services; Google LLC — OAuth authentication services; Vercel Inc. — service hosting and deployment; Anthropic PBC — AI image analysis and text generation; OpenAI — voice transcription and voice synthesis services.',
  '제8조 (정보주체의 권리·의무 및 그 행사방법)':
    'Article 8 (Rights and Obligations of Data Subjects and How to Exercise Them)',
  '정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다. 권리 행사는 회사에 대해 서면, 전화, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체없이 조치하겠습니다.':
    'A data subject may exercise rights against the Company at any time, including the right to request access to, correction or deletion of, or suspension of processing of personal information. These rights may be exercised in writing, by telephone, by email, or through other means, and the Company will take action without delay.',
  '제9조 (처리하는 개인정보의 안전성 확보 조치)':
    'Article 9 (Measures to Safeguard Personal Information)',
  '회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다. (1) 개인정보 취급 직원의 최소화 및 교육, (2) 개인정보에 대한 접근 제한, (3) 개인정보를 저장하는 데이터베이스 시스템에 대한 접근권한 관리, (4) 개인정보 처리시스템 등의 접근권한의 제한, (5) 접속기록의 보관 및 위·변조 방지.':
    'The Company takes the following measures to safeguard personal information: (1) minimizing and training employees who handle personal information; (2) restricting access to personal information; (3) managing access privileges for database systems that store personal information; (4) restricting access privileges for personal information processing systems; and (5) retaining access records and preventing their alteration or falsification.',
  '제10조 (개인정보 보호책임자)': 'Article 10 (Personal Information Protection Officer)',
  '회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 개인정보 보호책임자를 지정하고 있습니다. 개인정보 보호책임자: 김정호 (kinjungho@gmail.com).':
    'The Company has appointed a Personal Information Protection Officer who has overall responsibility for personal information processing and handles data subjects’ complaints and remedies for harm related to personal information processing. Personal Information Protection Officer: Jungho Kim (kinjungho@gmail.com).',
  '제11조 (개인정보 처리방침 변경)': 'Article 11 (Changes to the Privacy Policy)',
  '이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.':
    'This Privacy Policy applies from its effective date. If content is added, deleted, or corrected due to changes in laws or policies, notice will be provided through an announcement beginning seven days before the changes take effect.',
  '개인정보 관련 문의:': 'Privacy inquiries:',
  '· 회사명: 코마인드웍스': '· Company: Comindworks',

  '이용약관': 'Terms of Service',
  'Parro 서비스 이용 시 적용되는 약관과 규정을 안내합니다.':
    'These Terms explain the terms and rules that apply when using the Parro service.',
  '최종 수정일: 2026년 5월 27일 · 시행일: 2026년 5월 27일':
    'Last updated: May 27, 2026 · Effective date: May 27, 2026',
  '제1조 (목적)': 'Article 1 (Purpose)',
  '이 약관은 코마인드웍스(이하 "회사")가 제공하는 Parro 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.':
    'The purpose of these Terms is to set forth the rights, obligations, and responsibilities between Comindworks (hereinafter, the "Company") and users, and other necessary matters relating to use of the Parro service (hereinafter, the "Service") provided by the Company.',
  '제2조 (정의)': 'Article 2 (Definitions)',
  '"서비스"란 회사가 제공하는 hands-on training 플랫폼 Parro 및 관련 제반 서비스를 의미합니다. "이용자"란 이 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다. "회원"이란 회사에 개인정보를 제공하여 회원 등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며 서비스를 계속적으로 이용할 수 있는 자를 말합니다.':
    '"Service" means the Parro hands-on training platform and all related services provided by the Company. "User" means a member or non-member who receives services provided by the Company under these Terms. "Member" means a person who has provided personal information to the Company and registered as a member, continuously receives information from the Company, and may continue to use the Service.',
  '제3조 (약관의 효력 및 변경)': 'Article 3 (Effect and Amendment of the Terms)',
  '이 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 그 효력을 발생합니다. 회사는 합리적인 사유가 발생할 경우에는 이 약관을 변경할 수 있으며, 약관이 변경되는 경우 회사는 변경사항을 시행일자 7일 전부터 서비스 내 공지사항에 게시합니다.':
    'These Terms take effect for all users who wish to use the Service. The Company may amend these Terms when there is a reasonable basis to do so. If the Terms are amended, the Company will post the changes in a notice within the Service beginning seven days before the effective date.',
  '제4조 (서비스의 제공)': 'Article 4 (Provision of the Service)',
  '회사는 다음과 같은 서비스를 제공합니다. (1) AI 기반 인터랙티브 매뉴얼 자동 생성 서비스, (2) Chrome 확장 프로그램(Parro Recorder)을 통한 화면 캡처 및 매뉴얼 제작 서비스, (3) 제작된 매뉴얼의 공유 및 플레이어 서비스, (4) 기타 회사가 추가 개발하거나 다른 회사와의 제휴 계약 등을 통해 이용자에게 제공하는 일체의 서비스.':
    'The Company provides the following services: (1) automatic generation of AI-based interactive manuals; (2) screen capture and manual creation through the Chrome extension (Parro Recorder); (3) sharing and player services for created manuals; and (4) any other services that the Company develops or provides to users through partnership agreements or other arrangements with other companies.',
  '제5조 (이용요금)': 'Article 5 (Fees)',
  '서비스의 기본 이용은 무료입니다. 단, 일부 고급 기능(Pro 플랜)은 유료로 제공될 수 있으며, 유료 전환 전 별도로 안내합니다. 무료 플랜의 경우 일일 매뉴얼 생성 건수가 제한될 수 있습니다.':
    'Basic use of the Service is free. However, certain advanced features (the Pro plan) may be offered for a fee, and separate notice will be provided before conversion to a paid service. The number of manuals that can be created each day may be limited on the free plan.',
  '제6조 (회원가입)': 'Article 6 (Membership Registration)',
  '이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다. 회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.':
    'A user applies for membership by entering member information in the registration form prescribed by the Company and indicating agreement to these Terms. The Company will register a user who applies for membership as described in Paragraph 1 unless the user falls under any of the following items.',
  '제7조 (개인정보 보호)': 'Article 7 (Protection of Personal Information)',
  '회사는 이용자의 개인정보를 중요시하며, 개인정보 처리방침에 따라 이용자의 개인정보를 보호합니다. 개인정보와 관련한 사항은 별도의 개인정보 처리방침을 따릅니다.':
    'The Company values users’ personal information and protects it in accordance with the Privacy Policy. Matters relating to personal information are governed by the separate Privacy Policy.',
  '제8조 (이용자의 의무)': 'Article 8 (User Obligations)',
  '이용자는 다음 행위를 하여서는 안 됩니다: (1) 신청 또는 변경 시 허위 내용의 등록, (2) 타인의 정보 도용, (3) 회사가 게시한 정보의 변경, (4) 회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등)의 송신 또는 게시, (5) 회사 기타 제3자의 저작권 등 지적재산권에 대한 침해, (6) 회사 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위.':
    'Users must not engage in the following acts: (1) registering false information when applying or making changes; (2) misappropriating another person’s information; (3) altering information posted by the Company; (4) transmitting or posting information other than that specified by the Company, including computer programs; (5) infringing copyrights or other intellectual property rights of the Company or any third party; or (6) damaging the reputation of or interfering with the business of the Company or any third party.',
  '제9조 (서비스 중단)': 'Article 9 (Suspension of the Service)',
  '회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 또는 운영상 상당한 이유가 있는 경우 서비스의 제공을 일시적으로 중단할 수 있습니다. 서비스 중단의 경우에는 회사가 사전에 통지하며, 불가피한 경우 사후에 통지할 수 있습니다.':
    'The Company may temporarily suspend the Service for maintenance or inspection, replacement or failure of computers or other information and communications equipment, interruption of communications, or other substantial operational reasons. The Company will provide advance notice of a service suspension, but may provide notice afterward when advance notice is unavoidable.',
  '제10조 (분쟁해결)': 'Article 10 (Dispute Resolution)',
  '회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 처리절차를 운영합니다. 회사와 이용자 간에 발생한 전자상거래 분쟁에 관한 소송은 서울중앙지방법원을 전속관할로 합니다.':
    'The Company operates procedures to consider legitimate opinions or complaints raised by users and to process compensation for resulting harm. The Seoul Central District Court has exclusive jurisdiction over litigation concerning e-commerce disputes arising between the Company and users.',
  '문의:': 'Contact:',
};
