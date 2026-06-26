# 🎵 Music Overlay OBS

A highly customizable **Now Playing** overlay for **OBS Studio** with real-time audio visualization, animated widgets, album artwork and theme support.

Designed for streamers who want a clean, modern and fully customizable music overlay without relying on third-party services.

---

# Features

## Music Detection

* Windows Media Session integration
* Supports Spotify
* Supports YouTube (Chrome / Edge / Chromium browsers)
* Supports most media players exposing Media Session
* Automatic track detection
* Automatic album artwork extraction
* Fallback cover support

---

## Audio Visualization

Real-time FFT audio visualizer with multiple capture modes.

### Capture Modes

* Auto
* Process Capture
* System Capture

Automatic fallback to system capture when process capture is unavailable.

### FFT Settings

* Multiple FFT presets
* Custom sensitivity
* Smoothing
* Output Gain
* Spectral Contrast
* Visual Curve Power
* Auto Gain
* Built-in diagnostics

---

## Fully Customizable Overlay

Customize almost every visual element.

### Card

* Background
* Style
* Size
* Position

### Vinyl

* Multiple vinyl styles
* Animated rotation
* Custom themes

### Equalizer

* Multiple visual styles
* Glow
* Rainbow mode
* Color modes
* Height
* Width
* Bar count
* Spacing

### Fonts

* Font family
* Title size
* Artist size
* Ticker size

### Colors

* Background
* Text
* Progress bar
* Equalizer
* Particles

---

# Theme System

Music Overlay includes a built-in theme system.

## Built-in Themes

* Glass
* Neon Purple
* Spotify Green
* Frost
* Gold Luxury
* Blood Moon
* Retro Synthwave
* Terminal
* RGB Gamer

## Custom Themes

Create your own themes directly from the Settings window.

Features:

* Save current configuration
* Update existing theme
* Create unlimited custom themes
* Themes stored as JSON
* Easy backup and sharing

Location:

```text
overlay/themes/custom
```

---

# Settings

The application includes a full-featured configuration interface.

Current sections:

* Themes
* Position
* Sizes
* Colors
* Fonts
* Vinyl
* Equalizer
* Audio
* Animations
* Particles

Settings are automatically saved to:

```text
overlay/config.json
```

---

# Installation

## 1. Download

Download the latest release from the **Releases** page.

Extract the archive anywhere.

No installation is required.

---

## 2. Start Music Overlay

Run:

```text
MusicOverlay.exe
```

The local server will start automatically.

---

## 3. Add Browser Source to OBS

Create a new **Browser Source**.

URL:

```text
http://localhost:8799
```

Recommended:

```
Width: 1920
Height: 1080
FPS: 60
```

Enable:

```
✔ Shutdown source when not visible
✔ Refresh browser when scene becomes active
```

---

## 4. Open Settings

Open:

```text
http://localhost:8799/settings.html
```

or use the Settings button in the application.

---

# Configuration

Configuration is stored in

```text
overlay/config.json
```

Themes are stored in

```text
overlay/themes
```

Custom themes

```text
overlay/themes/custom
```

---

# Requirements

* Windows 10 / Windows 11
* OBS Studio
* Modern Chromium browser (recommended)
* .NET Runtime is **NOT required** (self-contained release)

---

# Roadmap

## Planned

* Live overlay updates via WebSocket
* Visual layout constructor
* Theme import/export
* Theme preview thumbnails
* More vinyl styles
* Advanced equalizer modes
* Better media player compatibility

---

# Screenshots

> Screenshots will be added soon.

---

# License

This project is licensed under the MIT License.

---

# Contributing

Pull requests, feature suggestions and bug reports are welcome.

If you find a bug, please create an Issue describing:

* Windows version
* Music player
* Browser (if applicable)
* Steps to reproduce

---

# Acknowledgements

Built for the streaming community ❤️
