; London Centre Tests – copy the offline speech model if it was downloaded next to the installer
!macro customInstall
  CreateDirectory "$INSTDIR\resources\speech"
  ClearErrors
  FindFirst $0 $1 "$EXEDIR\London-Centre-Tests-Speech-Model*.tar.gz"
  ${IfNot} ${Errors}
    DetailPrint "Installing the offline speech model ($1)"
    CopyFiles /SILENT "$EXEDIR\$1" "$INSTDIR\resources\speech\vosk-model-small-en-us-0.15.tar.gz"
  ${EndIf}
  FindClose $0
!macroend
