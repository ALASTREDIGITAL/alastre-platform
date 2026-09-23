@echo off
title Alastre Platform
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "C:\Projetos\ALASTRE DIGITAL\ALASTRE-PLATFORM\scripts\start-alastre-local.ps1"
if errorlevel 1 pause
