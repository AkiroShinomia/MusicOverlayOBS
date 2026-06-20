$body = @{
  name = "My Test Theme"
  theme = @{
    colors = @{
      background = "rgba(10, 10, 14, 0.80)"
      text = "#ffffff"
      progress = "#ffffff"
      progressBackground = "rgba(255, 255, 255, 0.18)"
    }
    font = @{
      family = "Arial"
      titleSize = 25
      artistSize = 16
      tickerSize = 14
    }
    audio = @{
      sourceMode = "system"
    }
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "http://localhost:8799/api/themes/custom" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body