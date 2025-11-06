#!/bin/bash

# Sonlandırılacak portlar
PORTS=(3001 1337 3000)

echo "Port kontrolü başlatılıyor..."

for PORT in "${PORTS[@]}"; do
    echo "Port $PORT kontrol ediliyor..."
    
    # Windows'ta netstat ile o portu kullanan PID'i bul
    PID=$(netstat -ano | grep ":$PORT " | grep "LISTENING" | awk '{print $5}' | head -n 1)
    
    if [ -z "$PID" ]; then
        echo "  Port $PORT üzerinde aktif process bulunamadı."
    else
        echo "  Port $PORT üzerinde PID $PID bulundu, sonlandırılıyor..."
        # Windows'ta process'i öldür
        taskkill //F //PID $PID 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "  ✓ PID $PID başarıyla sonlandırıldı."
        else
            echo "  ✗ PID $PID sonlandırılamadı (yönetici izni gerekebilir)."
        fi
    fi
    echo ""
done

echo "İşlem tamamlandı."