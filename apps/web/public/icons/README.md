# PWA Icons

다음 3개 파일을 이 디렉터리에 추가하세요(코드 변경 없이 manifest 가 참조함).

- `icon-192.png` — 192×192 PNG, 일반 아이콘
- `icon-512.png` — 512×512 PNG, 일반 아이콘
- `icon-512-maskable.png` — 512×512 PNG, **maskable 안전 영역 80%** 안에 그린 변형 (OS 가 원/사각/squircle 로 잘라낼 수 있도록)

빠른 생성 방법.

1. <https://maskable.app/editor> 에서 단순 monogram (예: "L") 을 디자인.
2. 일반 아이콘은 512×512 로 export 후 192×192 로도 export.
3. maskable 변형은 안전 영역에 맞춰 별도 export.

세 파일이 모두 없으면 manifest 가 깨지지 않지만 모바일 Safari "홈 화면에 추가" 시 generic 아이콘이 표시됩니다.
