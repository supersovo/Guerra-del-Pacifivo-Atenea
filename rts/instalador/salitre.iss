; Instalador de Windows (Inno Setup 6) de «Guerra del Pacífico: Salitre y Pólvora».
;
; Requisito: haber construido antes la carpeta del juego con PyInstaller
;     cd rts
;     pyinstaller --noconfirm instalador\salitre.spec
; Luego, desde rts\instalador:
;     iscc /DVersion=0.12.0 salitre.iss
; El instalador queda en rts\instalador\Salida\. Requiere Inno Setup 6.3 o más nuevo.
;
; Los datos del jugador (configuración, cuentas del servidor, repeticiones y
; registros) se guardan en %APPDATA%\GuerraDelPacifico y NO se borran al
; desinstalar.

#ifndef Version
  #define Version "0.0.0"
#endif
#define Nombre "Guerra del Pacífico: Salitre y Pólvora"
#define Exe "GuerraDelPacifico.exe"
#define ExeServidor "ServidorSalitre.exe"

[Setup]
AppId={{ACE6B95F-04CE-4283-8DBE-9425F61DE3FC}
AppName={#Nombre}
AppVersion={#Version}
AppVerName={#Nombre} {#Version}
AppPublisher=Proyecto Atenea
DefaultDirName={autopf}\GuerraDelPacifico
DefaultGroupName=Guerra del Pacífico
DisableProgramGroupPage=yes
OutputDir=Salida
OutputBaseFilename=GuerraDelPacifico-{#Version}-Instalador
SetupIconFile=..\recursos\icono.ico
UninstallDisplayIcon={app}\{#Exe}
UninstallDisplayName={#Nombre}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; x64compatible (Inno Setup 6.3 o más nuevo) permite instalar también en Windows ARM64
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; se puede instalar solo para el usuario actual (sin permisos de administrador)
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
VersionInfoVersion={#Version}
VersionInfoDescription={#Nombre}

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "escritorio"; Description: "Crear un acceso directo en el escritorio"; GroupDescription: "Accesos directos:"
Name: "cortafuegos"; Description: "Permitir partidas en red en el cortafuegos de Windows (redes privadas)"; GroupDescription: "Juego en red:"; Check: IsAdminInstallMode

[Files]
Source: "..\dist\GuerraDelPacifico\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Guerra del Pacífico"; Filename: "{app}\{#Exe}"; WorkingDir: "{app}"
Name: "{group}\Servidor dedicado"; Filename: "{app}\{#ExeServidor}"; WorkingDir: "{app}"; Comment: "Servidor para jugar con sus compañeros (puerto 47800)"
Name: "{group}\Desinstalar"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Guerra del Pacífico"; Filename: "{app}\{#Exe}"; WorkingDir: "{app}"; Tasks: escritorio

[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Guerra del Pacifico (juego)"" dir=in action=allow program=""{app}\{#Exe}"" enable=yes profile=private,domain"; Flags: runhidden; Tasks: cortafuegos; StatusMsg: "Configurando el cortafuegos..."
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Guerra del Pacifico (servidor)"" dir=in action=allow program=""{app}\{#ExeServidor}"" enable=yes profile=private,domain"; Flags: runhidden; Tasks: cortafuegos
Filename: "{app}\{#Exe}"; Description: "Jugar ahora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Guerra del Pacifico (juego)"""; Flags: runhidden; RunOnceId: "QuitarReglaJuego"; Check: IsAdminInstallMode
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Guerra del Pacifico (servidor)"""; Flags: runhidden; RunOnceId: "QuitarReglaServidor"; Check: IsAdminInstallMode
