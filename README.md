# 📚 시우지우 영어단어장

카메라로 찍고, 퀴즈로 외우고, 친구와 공유하는 중학생용 영어 단어장 PWA

## 주요 기능

- 📸 **단어 찍기**: 교과서/단어장 촬영 → Gemini AI가 단어 전부 추출 + 한글 뜻 자동 생성
- 🎯 **퀴즈 4종**: 영→한 / 한→영 객관식, 스펠링 입력, **듣고 말하기**(TTS+음성인식)
- 🔁 **간격 반복 학습**: 정답 시 1→3→7→14일 뒤 자동 복습 출제, 오답노트 가중치
- 🎁 **단어장 공유**: 6자리 코드/링크로 친구에게 공유 (Gemini 재호출 없이 복사)
- 🔥 **스트릭 & 뱃지**: 연속 학습일, 8종 뱃지
- 📴 **오프라인 지원**: 저장된 단어로 인터넷 없이 퀴즈 가능
- 🛡️ **승인제 운영**: 관리자가 승인한 사용자만 이용 가능 (화이트리스트)

## 설치 순서

### 1. Firebase 프로젝트 설정

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Authentication** → 로그인 방법 → **Google** 사용 설정
3. **Firestore Database** → 데이터베이스 만들기 (프로덕션 모드, 위치: asia-northeast3 서울)
4. 프로젝트 설정 → 일반 → 웹 앱 추가(</>) → SDK 구성 값 복사

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 Firebase SDK 값 + 관리자(본인) 이메일 입력:

```
VITE_FB_API_KEY=AIza...
VITE_FB_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FB_PROJECT_ID=xxx
VITE_FB_STORAGE_BUCKET=xxx.appspot.com
VITE_FB_MESSAGING_SENDER_ID=123...
VITE_FB_APP_ID=1:123...
VITE_ADMIN_EMAIL=본인구글이메일@gmail.com
```

### 3. 보안 규칙의 관리자 이메일 변경

`firestore.rules` 파일 7번째 줄의 `your-email@gmail.com`을 본인 이메일로 변경:

```
function adminEmail() { return '본인구글이메일@gmail.com'; }
```

### 4. Gemini API 키 등록 (Firebase 콘솔에서)

Firestore → 컬렉션 시작 → 아래와 같이 문서 생성:

| 항목 | 값 |
|---|---|
| 컬렉션 ID | `config` |
| 문서 ID | `gemini` |
| 필드 1 | `apiKey` (string) = 보유한 Gemini API 키 |
| 필드 2 | `model` (string) = `gemini-2.5-flash` |

> 모델명은 [Google AI Studio](https://aistudio.google.com)에서 현재 사용 가능한 flash 모델로 맞춰주세요.

### 5. 로컬 실행

```bash
npm install
npm run dev
```

### 6. 배포 (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase init   # Hosting(dist), Firestore 선택 — 기존 firebase.json 유지
npm run deploy  # 빌드 + 보안규칙 + 호스팅 배포
```

배포 후 **Authentication → 설정 → 승인된 도메인**에 배포 도메인이 있는지 확인.

### 7. ⚠️ Gemini 키 보호 설정 (필수)

[Google Cloud 콘솔 → API 및 서비스 → 사용자 인증 정보](https://console.cloud.google.com/apis/credentials)에서 해당 키에:

1. **애플리케이션 제한**: HTTP 리퍼러 → `https://본인도메인.web.app/*` 추가
2. **할당량 제한**: Generative Language API 일일 요청 수 제한 (예: 1,000회)
3. 결제 → 예산 알림 설정

이 설정으로 키가 노출되더라도 다른 곳에서 사용할 수 없습니다.

## 운영 방법

### 사용자 승인 (화이트리스트)

1. 시우/지우/친구가 구글 로그인 → 자동으로 "가입 신청" 상태
2. 관리자 계정으로 로그인 → **내 기록 → 🛡️ 사용자 승인 관리** → 승인 버튼
3. 승인 즉시 해당 사용자 앱 사용 가능

### 단어장 공유

단어장 상세 → "친구에게 공유 📤" → 카톡으로 코드/링크 전송 → 받은 사람이 홈의 "코드로 단어장 받기"에서 입력

## 폰에 설치 (PWA)

Android Chrome에서 사이트 접속 → 메뉴(⋮) → **"홈 화면에 추가"** → 네이티브 앱처럼 사용

## 기술 스택

React 18 + Vite · Firebase (Auth/Firestore/Hosting) · Gemini API · Framer Motion · vite-plugin-pwa

## 데이터 구조

```
config/gemini                  # API 키 (승인 사용자만 읽기)
allowedUsers/{email}           # 화이트리스트
accessRequests/{email}         # 가입 신청 대기
users/{uid}                    # 프로필 (스트릭, 사용량 등)
users/{uid}/words/{wordId}     # 단어 (날짜·암기상태·복습일정)
sharedWordbooks/{code}         # 공유 단어장 (30일 만료)
```
