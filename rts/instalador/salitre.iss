; Instalador de Windows (Inno Setup 6) de «Guerra del Pacífico: Salitre y Pólvora».
;
; Instala el cliente 3D (el juego principal, exportado de Godot), la versión clásica
; (pygame), el servidor dedicado y los datos que comparten.
;
; Requisito: haber armado antes la carpeta del juego (instalador\construir_windows.ps1
; lo hace todo): PyInstaller deja en dist\GuerraDelPacifico\ la versión clásica, el
; servidor y los datos, y a su lado va dist\cliente3d\windows\GuerraDelPacifico.exe.
; Luego, desde rts\instalador:
;     iscc /DVersion=0.14.1 salitre.iss
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
#define ExeClasico "GuerraDelPacificoClasico.exe"
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

[InstallDelete]
; Python y los datos de la versión anterior: se instalan de nuevo enteros
Type: filesandordirs; Name: "{app}\_internal"

[Files]
Source: "..\dist\GuerraDelPacifico\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Guerra del Pacífico"; Filename: "{app}\{#Exe}"; WorkingDir: "{app}"
Name: "{group}\Guerra del Pacífico (versión clásica)"; Filename: "{app}\{#ExeClasico}"; WorkingDir: "{app}"; Comment: "El juego en dos dimensiones, para equipos sin tarjeta de video"
Name: "{group}\Servidor dedicado"; Filename: "{app}\{#ExeServidor}"; WorkingDir: "{app}"; Comment: "Servidor para jugar con sus compañeros (puerto 47800)"
Name: "{group}\Desinstalar"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Guerra del Pacífico"; Filename: "{app}\{#Exe}"; WorkingDir: "{app}"; Tasks: escritorio

[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Guerra del Pacifico (juego)"" dir=in action=allow program=""{app}\{#Exe}"" enable=yes profile=private,domain"; Flags: runhidden; Tasks: cortafuegos; StatusMsg: "Configurando el cortafuegos..."
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Guerra del Pacifico (clasico)"" dir=in action=allow program=""{app}\{#ExeClasico}"" enable=yes profile=private,domain"; Flags: runhidden; Tasks: cortafuegos
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Guerra del Pacifico (servidor)"" dir=in action=allow program=""{app}\{#ExeServidor}"" enable=yes profile=private,domain"; Flags: runhidden; Tasks: cortafuegos
Filename: "{app}\{#Exe}"; Description: "Jugar ahora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Guerra del Pacifico (juego)"""; Flags: runhidden; RunOnceId: "QuitarReglaJuego"; Check: IsAdminInstallMode
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Guerra del Pacifico (clasico)"""; Flags: runhidden; RunOnceId: "QuitarReglaClasico"; Check: IsAdminInstallMode
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Guerra del Pacifico (servidor)"""; Flags: runhidden; RunOnceId: "QuitarReglaServidor"; Check: IsAdminInstallMode
