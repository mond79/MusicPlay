; ─────────────────────────────────────────────────
; Mond Play — Inno Setup 설치 스크립트
; 무료 설치 마법사 생성기: https://jrsoftware.org/isinfo.php
; ─────────────────────────────────────────────────

#define MyAppName      "Mond Play"
#define MyAppVersion   "1.0.0"
#define MyAppPublisher "Mond"
#define MyAppURL       "https://github.com/mond79/MusicPlay"
#define MyAppExeName   "MondPlay.exe"
#define MyAppID        "{A7B3C2D1-E4F5-6789-ABCD-EF0123456789}"

[Setup]
; 앱 고유 ID (재설치/업데이트 추적용)
AppId={{#MyAppID}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; 출력 설치파일 경로 및 이름
OutputDir=installer_output
OutputBaseFilename=MondPlay_Setup_v{#MyAppVersion}
; 압축 설정 (설치파일 크기 최소화)
Compression=lzma2/ultra64
SolidCompression=yes
; 최소 Windows 버전 (Windows 10)
MinVersion=10.0
; 64비트 전용
ArchitecturesInstallIn64BitMode=x64compatible
; 설치 화면 설정
WizardStyle=modern
; 관리자 권한 필요 여부 (Program Files에 설치하려면 필요)
PrivilegesRequired=admin

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; dist\MondPlay 폴더 전체 포함
Source: "dist\MondPlay\MondPlay.exe";      DestDir: "{app}"; Flags: ignoreversion
Source: "dist\MondPlay\_internal\*";       DestDir: "{app}\_internal"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; 시작 메뉴 아이콘
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
; 바탕화면 아이콘 (선택)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; 설치 완료 후 앱 바로 실행 옵션
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; 제거 시 사용자 데이터(MondPlay_Data)는 남겨두기
; Type: filesandordirs; Name: "{app}\MondPlay_Data"
