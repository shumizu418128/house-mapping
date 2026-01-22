// Leafletマップの初期化
const map = L.map('map').setView([35.6762, 139.6503], 13); // 東京をデフォルト位置に

// タイルレイヤーの追加
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
}).addTo(map);

// マーカーと検索履歴の管理
const markers = []; // 複数マーカーを管理
const markedAddresses = []; // マッピング済み住所を管理
const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
const addressInput = document.getElementById('addressInput');
const searchBtn = document.getElementById('searchBtn');
const resultInfo = document.getElementById('resultInfo');
const addressList = document.getElementById('addressList');
const clearAllBtn = document.getElementById('clearAllBtn');
const addressCount = document.getElementById('addressCount');
const addressSuggestions = document.getElementById('addressSuggestions');

// Yahoo!ジオコーダAPI設定
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiStatus = document.getElementById('apiStatus');

let yahooApiKey = localStorage.getItem('yahooApiKey') || '';

// APIキーの保存
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
        apiStatus.textContent = 'APIキーを入力してください';
        apiStatus.className = 'api-status error';
        return;
    }
    localStorage.setItem('yahooApiKey', key);
    yahooApiKey = key;
    apiStatus.textContent = '✓ 保存しました';
    apiStatus.className = 'api-status success';
    setTimeout(() => {
        apiStatus.textContent = '';
    }, 3000);
});

// ページ読み込み時にAPIキーを復元
if (yahooApiKey) {
    apiKeyInput.value = yahooApiKey;
    apiStatus.textContent = '✓ 設定済み';
    apiStatus.className = 'api-status success';
}

// マーカーグループを管理
const markerGroup = L.featureGroup();
markerGroup.addTo(map);

// ===== 住所正規化エンジン =====
// 表記ゆれの正規化処理
function normalizeAddress(address) {
    let normalized = address.trim();

    // 全角数字を半角に統一
    normalized = normalized.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

    // 丁目・番・号の表記ゆれを統一
    normalized = normalized.replace(/([0-9]+)\s*[-ー\-]\s*([0-9]+)\s*[-ー\-]\s*([0-9]+)/g, '$1丁目$2番$3号');
    normalized = normalized.replace(/([0-9]+)[-ー\-]([0-9]+)[-ー\-]([0-9]+)/g, '$1丁目$2番$3号');

    // 「丁目」「番」「号」の統一
    normalized = normalized.replace(/([0-9]+)\s*[-ー\-]\s*([0-9]+)(?!号)/g, '$1番$2号');
    normalized = normalized.replace(/([0-9]+)[-ー\-]([0-9]+)(?!号)/g, '$1番$2号');

    // スペースの統一
    normalized = normalized.replace(/\s+/g, '');

    // 通り名前などのゆれ対応
    normalized = normalized.replace(/\s*[\s]*$/g, ''); // 末尾の空白を削除

    return normalized;
}

// ===== ジオコーディング関数 =====
// 住所をジオコーディング（Yahoo!ジオコーダ APIを使用）
async function geocodeAddress(address) {
    try {
        if (!yahooApiKey) {
            resultInfo.className = 'result-info error';
            resultInfo.innerHTML = '<h3>エラー</h3><p>Yahoo!ジオコーダ APIキーを設定してください。</p>';
            return null;
        }

        searchBtn.classList.add('loading');
        searchBtn.disabled = true;
        resultInfo.className = 'result-info';
        resultInfo.innerHTML = '<p>検索中...</p>';

        // 複数の表記パターンで検索を試みる
        const patterns = [
            normalizeAddress(address), // 正規化版を優先
            address, // 元の入力
        ];

        for (const pattern of patterns) {
            try {
                const url = `https://map.yahooapis.jp/geocoding/V1/codeAddress?address=${encodeURIComponent(pattern)}&appid=${encodeURIComponent(yahooApiKey)}&output=json`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.Features && data.Features.length > 0) {
                    // 最初の結果を使用
                    const feature = data.Features[0];
                    const geometry = feature.Geometry || {};
                    const properties = feature.Properties || {};

                    const lat = geometry.Coordinates ? geometry.Coordinates[1] : null;
                    const lon = geometry.Coordinates ? geometry.Coordinates[0] : null;

                    if (!lat || !lon) continue;

                    const displayAddress = properties.Address || properties.AddressElement?.Pref?.Name + properties.AddressElement?.City?.Name + properties.AddressElement?.Town?.Name || address;

                    return {
                        lat: parseFloat(lat),
                        lon: parseFloat(lon),
                        name: displayAddress,
                        fullResult: feature
                    };
                }
            } catch (err) {
                console.error('パターン検索エラー:', err);
                continue;
            }
        }

        resultInfo.className = 'result-info error';
        resultInfo.innerHTML = '<h3>検索結果</h3><p>住所が見つかりませんでした。</p>';
        return null;
    } catch (error) {
        console.error('ジオコーディングエラー:', error);
        resultInfo.className = 'result-info error';
        resultInfo.innerHTML = '<h3>エラー</h3><p>検索中にエラーが発生しました。</p>';
        return null;
    } finally {
        searchBtn.classList.remove('loading');
        searchBtn.disabled = false;
    }
}

// 住所検索の提案を取得
async function getAddressSuggestions(query) {
    if (query.length < 3 || !yahooApiKey) {
        addressSuggestions.classList.remove('show');
        return;
    }

    try {
        const normalized = normalizeAddress(query);
        const url = `https://map.yahooapis.jp/geocoding/V1/codeAddress?address=${encodeURIComponent(normalized)}&appid=${encodeURIComponent(yahooApiKey)}&output=json&results=5`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.Features || data.Features.length === 0) {
            addressSuggestions.classList.remove('show');
            return;
        }

        addressSuggestions.innerHTML = '';

        data.Features.slice(0, 5).forEach((feature) => {
            const geometry = feature.Geometry || {};
            const properties = feature.Properties || {};

            const lat = geometry.Coordinates ? geometry.Coordinates[1] : null;
            const lon = geometry.Coordinates ? geometry.Coordinates[0] : null;

            if (!lat || !lon) return;

            const div = document.createElement('div');
            div.className = 'suggestion-item';

            const displayAddress = properties.Address || properties.AddressElement?.Pref?.Name + properties.AddressElement?.City?.Name + properties.AddressElement?.Town?.Name || '住所不明';
            const latStr = parseFloat(lat).toFixed(4);
            const lonStr = parseFloat(lon).toFixed(4);

            div.innerHTML = `
                <div class="suggestion-address">${displayAddress}</div>
                <div class="suggestion-coords">${latStr}, ${lonStr}</div>
            `;

            div.onclick = () => {
                addressInput.value = displayAddress;
                addressSuggestions.classList.remove('show');
                searchAddress(displayAddress);
            };

            addressSuggestions.appendChild(div);
        });

        if (addressSuggestions.children.length > 0) {
            addressSuggestions.classList.add('show');
        }
    } catch (error) {
        console.error('サジェスト取得エラー:', error);
    }
}

// ===== UIメンテナンス関数 =====
// マッピング済み住所リストを更新
function updateAddressList() {
    addressList.innerHTML = '';
    addressCount.textContent = markedAddresses.length;

    markedAddresses.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'address-item';

        const colorDiv = document.createElement('div');
        colorDiv.className = 'address-item-color';
        colorDiv.style.backgroundColor = colors[index % colors.length];

        const infoDiv = document.createElement('div');
        infoDiv.className = 'address-item-info';

        // 番地情報を含む詳細表示
        const fullResult = item.fullResult || {};
        const addressParts = fullResult.address || {};
        const detailed = addressParts.house_number ? ` ${addressParts.house_number}` : '';

        infoDiv.innerHTML = `
            <div class="address-item-address">${item.address}${detailed}</div>
            <div class="address-item-coords">${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}</div>
        `;
        infoDiv.onclick = () => centerMapOnAddress(index);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'address-item-btn';
        deleteBtn.textContent = '削除';
        deleteBtn.onclick = () => removeAddress(index);

        li.appendChild(colorDiv);
        li.appendChild(infoDiv);
        li.appendChild(deleteBtn);
        addressList.appendChild(li);
    });

    // すべてクリアボタンの表示
    if (markedAddresses.length > 1) {
        clearAllBtn.style.display = 'block';
    } else {
        clearAllBtn.style.display = 'none';
    }
}

// マップ上の特定の住所を中心にする
function centerMapOnAddress(index) {
    const item = markedAddresses[index];
    // 番地が含まれる場合はズームレベルを上げる
    const zoomLevel = item.fullResult?.address?.house_number ? 18 : 15;
    map.setView([item.lat, item.lon], zoomLevel);
    markers[index].openPopup();
}

// 住所を削除
function removeAddress(index) {
    const marker = markers[index];
    markerGroup.removeLayer(marker);
    markedAddresses.splice(index, 1);
    markers.splice(index, 1);
    updateAddressList();
}

// すべての住所をクリア
function clearAllAddresses() {
    if (!confirm('すべてのマーカーをクリアしますか？')) return;

    markerGroup.clearLayers();
    markedAddresses.length = 0;
    markers.length = 0;
    updateAddressList();
    resultInfo.className = 'result-info';
    resultInfo.innerHTML = '';
}

// 検索履歴を保存
function addToHistory(address, lat, lon) {
    // 検索履歴機能は削除されました
}

// ===== 住所検索メイン関数 =====
// 住所を検索してマップに追加
async function searchAddress(address) {
    if (!address.trim()) {
        resultInfo.className = 'result-info error';
        resultInfo.innerHTML = '<h3>エラー</h3><p>住所を入力してください。</p>';
        return;
    }

    addressSuggestions.classList.remove('show');

    const result = await geocodeAddress(address);

    if (!result) {
        return;
    }

    // 重複チェック（正規化版で比較）
    const normalizedInput = normalizeAddress(address);
    const isDuplicate = markedAddresses.some(item =>
        normalizeAddress(item.address) === normalizedInput
    );
    if (isDuplicate) {
        resultInfo.className = 'result-info error';
        resultInfo.innerHTML = '<h3>警告</h3><p>この住所は既に追加されています。</p>';
        addressInput.value = '';
        return;
    }

    // 新しいマーカーを追加
    const colorIndex = markedAddresses.length;
    const markerColor = colors[colorIndex % colors.length];

    const marker = L.marker([result.lat, result.lon], {
        title: address
    })
        .bindPopup(`
            <div style="font-size: 12px;">
                <strong>${address}</strong><br><br>
                <strong>座標</strong><br>
                緯度: ${result.lat.toFixed(6)}<br>
                経度: ${result.lon.toFixed(6)}
            </div>
        `);

    markerGroup.addLayer(marker);
    markers.push(marker);

    // マッピング済み住所に追加
    markedAddresses.push({
        address: address,
        lat: result.lat,
        lon: result.lon,
        color: markerColor,
        fullResult: result.fullResult
    });

    // 検索履歴に追加
    addToHistory(address, result.lat, result.lon);

    // UIを更新
    updateAddressList();

    // 結果情報を表示
    const addressParts = result.fullResult?.address || {};
    const detailInfo = addressParts.house_number ? `<p>番地: ${addressParts.house_number}</p>` : '';

    resultInfo.className = 'result-info success';
    resultInfo.innerHTML = `
        <h3>✓ 追加しました</h3>
        <p><strong>${address}</strong></p>
        ${detailInfo}
        <p>緯度: ${result.lat.toFixed(6)}</p>
        <p>経度: ${result.lon.toFixed(6)}</p>
    `;

    // マップを調整（全マーカーが見えるように）
    if (markedAddresses.length > 0) {
        map.fitBounds(markerGroup.getBounds().pad(0.1));
    }

    addressInput.value = '';
}

// ===== イベントリスナー =====
searchBtn.addEventListener('click', () => {
    searchAddress(addressInput.value);
});

clearAllBtn.addEventListener('click', clearAllAddresses);

addressInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        searchAddress(addressInput.value);
    }
});

// リアルタイムサジェスト
addressInput.addEventListener('input', (event) => {
    getAddressSuggestions(event.target.value);
});

// サジェスト外をクリックしたときに非表示
document.addEventListener('click', (event) => {
    if (event.target !== addressInput && event.target !== addressSuggestions) {
        addressSuggestions.classList.remove('show');
    }
});

// ページ読み込み時に初期化
updateAddressList();
