while ($true) {
    $services = @{
        8081 = "C:\northstar-tcc\tcc_server.js"
        8082 = "C:\northstar-pairx\pairx_server.js"
        8083 = "C:\northstar-ilogix\ilogix_server.js"
        8084 = "C:\northstar-quadrant\quadrant_server.js"
        8085 = "C:\northstar-verdact\verdact_server.js"
        8083 = "C:\northstar-ilogix\ilogix_server.js"
        8084 = "C:\northstar-quadrant\quadrant_server.js"
        8085 = "C:\northstar-verdact\verdact_server.js"
    }
    
    # Load all env vars from Machine level
    $env:STRIPE_SECRET_KEY = [System.Environment]::GetEnvironmentVariable("STRIPE_SECRET_KEY","Machine")
    $env:TCC_WEBHOOK_SECRET = [System.Environment]::GetEnvironmentVariable("TCC_WEBHOOK_SECRET","Machine")
    $env:PAIRX_WEBHOOK_SECRET = [System.Environment]::GetEnvironmentVariable("PAIRX_WEBHOOK_SECRET","Machine")
    $env:STRIPE_PRICE_TCC_SINGLE = [System.Environment]::GetEnvironmentVariable("STRIPE_PRICE_TCC_SINGLE","Machine")
    $env:STRIPE_PRICE_TCC_PRO = [System.Environment]::GetEnvironmentVariable("STRIPE_PRICE_TCC_PRO","Machine")
    $env:STRIPE_PRICE_PAIRX_SINGLE = [System.Environment]::GetEnvironmentVariable("STRIPE_PRICE_PAIRX_SINGLE","Machine")
    $env:STRIPE_PRICE_PAIRX_BUNDLE = [System.Environment]::GetEnvironmentVariable("STRIPE_PRICE_PAIRX_BUNDLE","Machine")
    $env:RESEND_API_KEY = [System.Environment]::GetEnvironmentVariable("RESEND_API_KEY","Machine")
    $env:LLM_API_KEY = [System.Environment]::GetEnvironmentVariable("LLM_API_KEY","Machine")
    
    foreach ($port in $services.Keys) {
        $script = $services[$port]
        try {
            $conn = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
            if (-not $conn) {
                Start-Process -NoNewWindow -FilePath "node" -ArgumentList $script
                $msg = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') RESTARTED port $port ($script)"
                Add-Content "C:\northstar-gateway\watchdog.log" $msg
                Write-Host $msg
            }
        } catch {
            Start-Process -NoNewWindow -FilePath "node" -ArgumentList $script
            Add-Content "C:\northstar-gateway\watchdog.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ERROR/RESTARTED port $port"
        }
    }
    
    # Also verify NorthStarGateway Windows service is running
    $gw = Get-Service -Name "NorthStarGateway" -ErrorAction SilentlyContinue
    if ($gw -and $gw.Status -ne "Running") {
        Start-Service -Name "NorthStarGateway"
        Add-Content "C:\northstar-gateway\watchdog.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') RESTARTED NorthStarGateway service"
    }
    
    $wh = Get-Service -Name "NorthStarWebhook" -ErrorAction SilentlyContinue
    if ($wh -and $wh.Status -ne "Running") {
        Start-Service -Name "NorthStarWebhook"
        Add-Content "C:\northstar-gateway\watchdog.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') RESTARTED NorthStarWebhook service"
    }
    
    Start-Sleep 300
}
