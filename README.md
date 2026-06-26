# 🎵 Music Overlay OBS

A highly customizable **Now Playing** overlay for **OBS Studio** with real-time audio visualization, album artwork, themes and animated widgets.

---

# Installation

## 1. Download

Download the latest release from the Releases page.

Extract the archive anywhere.

No installation is required.

---

## 2. Start Music Overlay

Run

```
MusicOverlay.exe
```

---

## 3. Add Browser Source to OBS

URL

```
http://localhost:8799
```

Recommended Browser Source settings

```
1920×1080
60 FPS
```

---

## 4. Open Settings

```
http://localhost:8799/settings.html
```

### Build from Source

### Requirements

* Windows 10 / Windows 11
* .NET SDK 8.0 or newer
* Git

Verify your .NET installation:

```bash
dotnet --version
```

### 1. Clone the repository

```bash
git clone https://github.com/AkiroShinomia/MusicOverlayOBS.git
cd MusicOverlayOBS
```

### 2. Restore dependencies

```bash
dotnet restore
```

### 3. Run in Development Mode

```bash
dotnet run
```

After the application starts, open:

```
http://localhost:8799
```

Settings page:

```
http://localhost:8799/settings.html
```

### 4. Build a Release Version

```bash
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:IncludeNativeLibrariesForSelfExtract=true /p:EnableCompressionInSingleFile=true -o publish
```

The compiled application will be available in:

```
publish/
```

Run:

```
publish/MusicOverlay.exe
```

---

# Features

## Music Detection

* Spotify
* YouTube
* Chromium browsers
* Windows Media Session
* Album artwork
* Automatic fallback cover

---

## Audio Visualization

* Process Capture
* System Capture
* Auto Capture
* FFT Presets
* Auto Gain
* Equalizer customization

---

## Themes

Built-in themes

* Glass
* Neon Purple
* Spotify Green
* Frost
* Gold Luxury
* Blood Moon
* Retro Synthwave
* Terminal
* RGB Gamer

Custom themes

* Save
* Update
* JSON based
* Unlimited

---

## Customization

* Card
* Vinyl
* Equalizer
* Colors
* Fonts
* Animations
* Particles

---

# Configuration

Config

```
overlay/config.json
```

Themes

```
overlay/themes
```

Custom Themes

```
overlay/themes/custom
```

---

# Screenshots

Coming soon.

---

# Roadmap

* Live WebSocket updates
* Theme import/export
* Visual layout constructor
* Advanced vinyl customization
* More equalizer modes

---

# 🎵 Music Overlay OBS

Полностью настраиваемый **Now Playing Overlay** для **OBS Studio** с отображением текущего трека, обложек альбомов, анимированным эквалайзером и системой пользовательских тем.

---

# Установка

## 1. Скачайте релиз

Скачайте последнюю версию со страницы Releases.

Распакуйте архив в любое удобное место.

Установка не требуется.

---

## 2. Запустите программу

```
MusicOverlay.exe
```

---

## 3. Добавьте Browser Source в OBS

URL

```
http://localhost:8799
```

Рекомендуемые параметры

```
1920×1080
60 FPS
```

---

## 4. Откройте настройки

```
http://localhost:8799/settings.html
```

---

## 🛠️ Сборка из исходного кода

### Требования

* Windows 10 / Windows 11
* .NET SDK 8.0 или новее
* Git

Проверьте установленную версию .NET:

```bash
dotnet --version
```

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/AkiroShinomia/MusicOverlayOBS.git
cd MusicOverlayOBS
```

### 2. Восстановите зависимости

```bash
dotnet restore
```

### 3. Запустите проект в режиме разработки

```bash
dotnet run
```

После запуска приложение будет доступно по адресу:

```
http://localhost:8799
```

Страница настроек:

```
http://localhost:8799/settings.html
```

### 4. Соберите релизную версию

```bash
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:IncludeNativeLibrariesForSelfExtract=true /p:EnableCompressionInSingleFile=true -o publish
```

Готовая сборка будет находиться в папке:

```
publish/
```

Для запуска используйте:

```
publish/MusicOverlay.exe
```

# Возможности


## Определение музыки

Поддерживается:

* Spotify
* YouTube
* Chromium-браузеры
* Windows Media Session
* Обложки альбомов
* Автоматическая подстановка стандартной обложки

---

## Эквалайзер

* Захват процесса
* Захват системного звука
* Автоматический режим
* FFT-пресеты
* Auto Gain
* Гибкая настройка отображения

---

## Темы

Встроенные темы

* Glass
* Neon Purple
* Spotify Green
* Frost
* Gold Luxury
* Blood Moon
* Retro Synthwave
* Terminal
* RGB Gamer

Пользовательские темы

* Создание
* Обновление
* Хранение в JSON
* Неограниченное количество

---

## Настройка интерфейса

Можно изменять:

* Карточку
* Пластинку
* Эквалайзер
* Цвета
* Шрифты
* Анимации
* Частицы

---

# Конфигурация

Основной конфиг

```
overlay/config.json
```

Встроенные темы

```
overlay/themes
```

Пользовательские темы

```
overlay/themes/custom
```

---

# Скриншоты

Будут добавлены позже.

---

# Планы

* Автоматическое обновление Overlay через WebSocket
* Импорт и экспорт тем
* Визуальный конструктор
* Расширенная кастомизация пластинок
* Новые режимы эквалайзера

