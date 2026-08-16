@echo off
set SCRIPT="%TEMP%\%RANDOM%-%RANDOM%-%RANDOM%-%RANDOM%.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\QueChimbaParce_Pro_CRM.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0dist\QueChimbaParce_CRM\QueChimbaParce_CRM.exe" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0dist\QueChimbaParce_CRM\" >> %SCRIPT%
echo oLink.Description = "App de Escritorio CRM Que Chimba Parce" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript /nologo %SCRIPT%
del %SCRIPT%
echo ¡Acceso directo creado en tu Escritorio de Windows con éxito!
