/**
 * OAuthGuideData.ts
 *
 * 각 소셜 플랫폼의 OAuth Client ID/Secret 발급 단계별 가이드.
 * 비개발자(점주)가 직접 따라할 수 있도록 구체적인 클릭 경로와 명칭을 포함합니다.
 */

export interface GuideStep {
  title: string;           // 단계 제목
  desc: string;            // 설명 (마크다운 없이 단순 텍스트)
  substeps?: string[];     // 세부 클릭 경로 (→ 로 연결)
  note?: string;           // 주의사항 / 팁
  copyValue?: 'redirectUri' | 'appName'; // 이 단계에서 복사해야 할 값 종류
  inputHint?: string;      // 이 단계에서 어디에 붙여넣어야 하는지
  highlight?: string;      // 화면에서 찾아야 할 핵심 텍스트 (형광펜 효과용)
  link?: string;           // 외부 링크
  linkLabel?: string;
}

export interface OAuthGuide {
  provider: string;
  label: string;
  icon: string;
  color: string;
  summary: string;         // 한 줄 요약
  estimatedMinutes: number;
  consoleUrl: string;
  steps: GuideStep[];
  whereToFind: {           // 최종적으로 어디서 Client ID/Secret 를 찾는지
    clientIdPath: string;
    clientSecretPath: string;
  };
}

// ─── Threads (Meta) ───────────────────────────────────────────────────────────
export const THREADS_GUIDE: OAuthGuide = {
  provider: 'threads',
  label: 'Threads (Meta)',
  icon: '🧵',
  color: '#000000',
  summary: 'Meta 개발자 계정으로 앱을 만들고, Threads API를 추가해 키를 발급받습니다.',
  estimatedMinutes: 10,
  consoleUrl: 'https://developers.facebook.com',
  whereToFind: {
    clientIdPath: '앱 설정 → 기본 설정 → 앱 ID',
    clientSecretPath: '앱 설정 → 기본 설정 → 앱 시크릿 코드 (보기 클릭)',
  },
  steps: [
    {
      title: 'Meta 개발자 계정 만들기',
      desc: 'Meta(Facebook) 계정이 있어야 합니다. 개인 페이스북 계정으로 로그인하면 됩니다.',
      substeps: ['developers.facebook.com 접속', '오른쪽 위 → 로그인', 'Facebook 계정으로 로그인'],
      link: 'https://developers.facebook.com',
      linkLabel: 'Meta 개발자 센터 열기',
      note: '기존 Facebook 계정으로 바로 로그인 가능합니다. 새 계정을 만들 필요가 없습니다.',
    },
    {
      title: '새 앱 만들기',
      desc: '로그인 후 내 앱 목록 화면에서 새 앱을 만듭니다.',
      substeps: ['오른쪽 위 → 내 앱', '파란 버튼 → 앱 만들기', '앱 유형: "비즈니스" 선택 → 다음'],
      note: '앱 이름은 "내 매장 이름 + SNS" 처럼 자유롭게 지어도 됩니다.',
    },
    {
      title: '앱 정보 입력',
      desc: '앱 이름과 이메일을 입력합니다.',
      substeps: ['앱 표시 이름: 원하는 이름 입력 (예: 우리카페 SNS)', '앱 연락처 이메일: 내 이메일 입력', '앱 만들기 버튼 클릭'],
    },
    {
      title: 'Threads API 제품 추가',
      desc: '앱 대시보드에서 Threads API 기능을 추가합니다.',
      substeps: ['왼쪽 메뉴 → 제품 추가', '목록에서 "Threads API" 찾기', '"설정" 버튼 클릭'],
      highlight: 'Threads API',
      note: '목록에서 Threads API가 보이지 않으면 검색창에 "Threads"를 입력하세요.',
    },
    {
      title: 'Redirect URI(콜백 URL) 등록',
      desc: '앱이 로그인 후 돌아올 주소를 등록합니다. 아래 주소를 복사해서 붙여넣으세요.',
      substeps: ['왼쪽 메뉴 → Threads API → 설정', '"Redirect Callback URLs" 항목 찾기', '아래 주소를 복사 후 붙여넣기', '변경 사항 저장 클릭'],
      copyValue: 'redirectUri',
      inputHint: '"Redirect Callback URLs" 또는 "Valid OAuth Redirect URIs" 입력란',
    },
    {
      title: 'Client ID(앱 ID)와 Secret 복사',
      desc: '이제 앱 ID와 시크릿 코드를 찾아 아래 입력란에 붙여넣으면 됩니다.',
      substeps: ['왼쪽 메뉴 → 앱 설정 → 기본 설정', '"앱 ID" 항목 → 숫자를 복사', '"앱 시크릿 코드" 항목 → "보기" 클릭 후 복사'],
      highlight: '앱 ID',
      note: '앱 시크릿 코드는 "보기" 버튼을 클릭해야 보입니다. 절대 타인에게 공유하지 마세요.',
    },
  ],
};

// ─── Naver Blog ───────────────────────────────────────────────────────────────
export const NAVER_GUIDE: OAuthGuide = {
  provider: 'naver_blog',
  label: 'Naver Blog',
  icon: '🟢',
  color: '#03C75A',
  summary: '네이버 개발자 센터에서 애플리케이션을 등록하고 클라이언트 ID를 발급받습니다.',
  estimatedMinutes: 8,
  consoleUrl: 'https://developers.naver.com/apps/#/register',
  whereToFind: {
    clientIdPath: '내 애플리케이션 → 앱 이름 클릭 → 개요 → Client ID',
    clientSecretPath: '내 애플리케이션 → 앱 이름 클릭 → 개요 → Client Secret',
  },
  steps: [
    {
      title: '네이버 로그인',
      desc: '네이버 개발자 센터에 네이버 계정으로 로그인합니다.',
      substeps: ['developers.naver.com 접속', '오른쪽 위 → 로그인', '네이버 아이디/비밀번호 입력'],
      link: 'https://developers.naver.com',
      linkLabel: '네이버 개발자 센터 열기',
    },
    {
      title: '애플리케이션 등록 메뉴로 이동',
      desc: '로그인 후 애플리케이션 등록 화면으로 이동합니다.',
      substeps: ['상단 메뉴 → Application → 애플리케이션 등록'],
      highlight: '애플리케이션 등록',
    },
    {
      title: '애플리케이션 이름과 사용 API 선택',
      desc: '앱 이름을 입력하고, 사용할 API를 선택합니다.',
      substeps: ['애플리케이션 이름: 원하는 이름 입력 (예: 우리가게블로그)', '사용 API → "블로그" 선택 체크', '"등록하기" 클릭'],
      note: '"블로그" 항목이 보이지 않으면 스크롤을 내려서 찾아보세요.',
      highlight: '블로그',
    },
    {
      title: '서비스 URL 등록',
      desc: '내 서비스 주소(MyBiz 도메인)를 등록합니다.',
      substeps: ['PC 웹 → 서비스 URL: https://mybiz.ai.kr 입력', '"등록하기" 버튼 클릭'],
    },
    {
      title: 'Callback URL(Redirect URI) 등록',
      desc: '로그인 완료 후 돌아올 주소를 등록합니다. 아래 주소를 복사하세요.',
      substeps: ['등록 완료 후 → 내 애플리케이션 목록 → 방금 만든 앱 클릭', '"API 설정" 탭 클릭', '"Callback URL" 항목 → 아래 주소 붙여넣기', '"수정" 버튼 클릭'],
      copyValue: 'redirectUri',
      inputHint: '"Callback URL" 입력란',
      highlight: 'Callback URL',
    },
    {
      title: 'Client ID와 Client Secret 복사',
      desc: '방금 만든 앱의 클라이언트 정보를 복사합니다.',
      substeps: ['내 애플리케이션 → 앱 이름 클릭', '"개요" 탭에서 Client ID 복사', 'Client Secret 옆 "보기" 클릭 후 복사'],
      note: 'Client Secret은 "보기" 버튼을 눌러야만 확인됩니다.',
    },
  ],
};

// ─── YouTube (Google) ─────────────────────────────────────────────────────────
export const YOUTUBE_GUIDE: OAuthGuide = {
  provider: 'youtube',
  label: 'YouTube (Google)',
  icon: '▶️',
  color: '#FF0000',
  summary: 'Google Cloud에서 프로젝트를 만들고 YouTube API를 활성화한 뒤 OAuth 키를 발급받습니다.',
  estimatedMinutes: 15,
  consoleUrl: 'https://console.cloud.google.com',
  whereToFind: {
    clientIdPath: 'API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID → 클라이언트 ID',
    clientSecretPath: '같은 화면 → 클라이언트 보안 비밀번호',
  },
  steps: [
    {
      title: 'Google Cloud Console 접속',
      desc: 'Google 계정(Gmail)으로 로그인합니다. YouTube 채널이 연결된 Google 계정으로 로그인하세요.',
      link: 'https://console.cloud.google.com',
      linkLabel: 'Google Cloud Console 열기',
      note: 'YouTube 채널 관리에 사용하는 구글 계정과 동일한 계정으로 로그인하는 것이 편합니다.',
    },
    {
      title: '새 프로젝트 만들기',
      desc: '상단에서 새 프로젝트를 만듭니다.',
      substeps: ['상단 왼쪽 → 프로젝트 선택 드롭다운', '"새 프로젝트" 클릭', '프로젝트 이름 입력 (예: 우리가게 유튜브)', '"만들기" 클릭'],
    },
    {
      title: 'YouTube Data API v3 활성화',
      desc: 'YouTube 업로드 기능을 사용하기 위해 API를 켭니다.',
      substeps: ['왼쪽 메뉴 → API 및 서비스 → 라이브러리', '검색창에 "YouTube Data API v3" 입력', '검색 결과 클릭 → 파란 "사용" 버튼 클릭'],
      highlight: 'YouTube Data API v3',
      note: '"사용" 버튼이 파란색이면 아직 꺼져 있는 상태입니다. 클릭해서 활성화하세요.',
    },
    {
      title: 'OAuth 동의 화면 설정',
      desc: '사용자가 로그인할 때 보여지는 동의 화면을 설정합니다.',
      substeps: ['왼쪽 메뉴 → API 및 서비스 → OAuth 동의 화면', '사용자 유형: "외부" 선택 → "만들기"', '앱 이름: 내 매장명 입력', '사용자 지원 이메일: 내 이메일 입력', '아래로 스크롤 → "저장 후 계속"'],
      note: '스코프(범위) 설정 화면에서 "저장 후 계속"을 눌러 기본값으로 넘어가도 됩니다.',
    },
    {
      title: 'OAuth 2.0 클라이언트 ID 만들기',
      desc: '실제 로그인에 사용할 키를 발급받습니다.',
      substeps: ['왼쪽 메뉴 → API 및 서비스 → 사용자 인증 정보', '위에 "+ 사용자 인증 정보 만들기" 클릭', '"OAuth 클라이언트 ID" 선택', '애플리케이션 유형: "웹 애플리케이션" 선택', '이름: 원하는 이름 입력'],
      highlight: 'OAuth 클라이언트 ID',
    },
    {
      title: 'Redirect URI 등록',
      desc: '로그인 후 돌아올 주소를 등록합니다. 아래 주소를 복사해서 붙여넣으세요.',
      substeps: ['"승인된 리디렉션 URI" 항목 → "+ URI 추가" 클릭', '아래 주소를 붙여넣기', '"만들기" 버튼 클릭'],
      copyValue: 'redirectUri',
      inputHint: '"승인된 리디렉션 URI" 입력란',
      highlight: '승인된 리디렉션 URI',
    },
    {
      title: 'Client ID와 Secret 복사',
      desc: '팝업이 뜨면서 클라이언트 ID와 Secret이 표시됩니다.',
      substeps: ['"클라이언트 ID" 복사 (숫자와 영문자로 된 긴 문자열)', '"클라이언트 보안 비밀번호" 복사', '아래 입력란에 각각 붙여넣기'],
      note: '팝업이 닫혔다면: 사용자 인증 정보 목록 → 방금 만든 항목 옆 연필 아이콘(수정) 클릭',
    },
  ],
};

// ─── Kakao ────────────────────────────────────────────────────────────────────
export const KAKAO_GUIDE: OAuthGuide = {
  provider: 'kakao_share',
  label: 'Kakao',
  icon: '💛',
  color: '#FEE500',
  summary: '카카오 개발자 센터에서 앱을 만들고 JavaScript 키를 발급받습니다.',
  estimatedMinutes: 5,
  consoleUrl: 'https://developers.kakao.com/console/app',
  whereToFind: {
    clientIdPath: '내 애플리케이션 → 앱 이름 → 앱 키 → JavaScript 키',
    clientSecretPath: '(카카오는 JavaScript 키만 필요합니다)',
  },
  steps: [
    {
      title: '카카오 개발자 로그인',
      desc: '카카오 계정으로 개발자 센터에 로그인합니다.',
      substeps: ['developers.kakao.com 접속', '오른쪽 위 → 로그인', '카카오 계정(전화번호 또는 이메일)으로 로그인'],
      link: 'https://developers.kakao.com',
      linkLabel: '카카오 개발자 센터 열기',
    },
    {
      title: '새 애플리케이션 만들기',
      desc: '내 앱 목록에서 새 앱을 만듭니다.',
      substeps: ['상단 메뉴 → 내 애플리케이션', '"애플리케이션 추가하기" 클릭', '앱 이름: 원하는 이름 입력 (예: 우리카페)', '사업자명: 상호 또는 이름 입력', '"저장" 클릭'],
    },
    {
      title: '플랫폼 등록',
      desc: '카카오 공유를 사용할 웹사이트 주소를 등록합니다.',
      substeps: ['앱 클릭 → 왼쪽 메뉴 → 플랫폼', '"Web 플랫폼 등록" 클릭', '사이트 도메인: https://mybiz.ai.kr 입력', '"저장" 클릭'],
      highlight: 'Web 플랫폼 등록',
    },
    {
      title: 'JavaScript 키 복사',
      desc: '카카오 공유는 JavaScript 키 하나만 있으면 됩니다.',
      substeps: ['왼쪽 메뉴 → 앱 키', '"JavaScript 키" 항목에서 복사 버튼 클릭'],
      highlight: 'JavaScript 키',
      note: '카카오는 Client Secret이 필요하지 않습니다. JavaScript 키만 입력하시면 됩니다.',
    },
  ],
};

export const ALL_GUIDES: Record<string, OAuthGuide> = {
  threads: THREADS_GUIDE,
  naver_blog: NAVER_GUIDE,
  youtube: YOUTUBE_GUIDE,
  kakao_share: KAKAO_GUIDE,
};
