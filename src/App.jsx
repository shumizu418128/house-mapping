import { useCallback, useEffect, useRef, useState } from 'react';
import Map from './components/Map';

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

function App() {
  const [yahooApiKey, setYahooApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiStatus, setApiStatus] = useState({ text: '', type: '' });
  const [addressInput, setAddressInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [markedAddresses, setMarkedAddresses] = useState([]);
  const [resultInfo, setResultInfo] = useState({ type: '', content: '' });
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef(null);
  const markerGroupRef = useRef(null);
  const suggestionsRef = useRef(null);

  // ページ読み込み時にAPIキーを復元
  useEffect(() => {
    const savedKey = localStorage.getItem('yahooApiKey') || '';
    if (savedKey) {
      setYahooApiKey(savedKey);
      setApiKeyInput(savedKey);
      setApiStatus({ text: '✓ 設定済み', type: 'success' });
    }
  }, []);

  // マップの準備完了時のコールバック
  const handleMapReady = useCallback((map, markerGroup) => {
    mapRef.current = map;
    markerGroupRef.current = markerGroup;
  }, []);

  // 住所の基本的なクリーンアップ（余分な空白のみ削除）
  const cleanAddress = (address) => {
    return address.trim().replace(/\s+/g, ' ');
  };

  // APIのベースURLを取得
  const getApiBaseUrl = () => {
    const isDev = import.meta.env.DEV;
    return isDev
      ? '/api/yahoo-geocoding'
      : 'https://map.yahooapis.jp/geocode/V1/geoCoder';
  };

  // 座標を文字列から取得（"経度,緯度"形式）
  const parseCoordinates = (coordinatesString) => {
    if (!coordinatesString) return { lat: null, lon: null };

    const coords = coordinatesString.split(',');
    if (coords.length >= 2) {
      const lon = parseFloat(coords[0].trim());
      const lat = parseFloat(coords[1].trim());
      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    }
    return { lat: null, lon: null };
  };

  // Featureから住所情報を抽出
  const extractAddressFromFeature = (feature, fallbackAddress = '') => {
    const property = feature.Property || {};
    return property.Address || feature.Name || fallbackAddress;
  };

  // APIキーの保存
  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setApiStatus({ text: 'APIキーを入力してください', type: 'error' });
      return;
    }
    localStorage.setItem('yahooApiKey', key);
    setYahooApiKey(key);
    setApiStatus({ text: '✓ 保存しました', type: 'success' });
    setTimeout(() => {
      setApiStatus({ text: '', type: '' });
    }, 3000);
  };

  // ジオコーディング関数
  const geocodeAddress = async (address) => {
    try {
      if (!yahooApiKey) {
        setResultInfo({
          type: 'error',
          content: '<h3>エラー</h3><p>Yahoo!ジオコーダ APIキーを設定してください。</p>'
        });
        return null;
      }

      setIsLoading(true);
      setResultInfo({ type: '', content: '<p>検索中...</p>' });

      // 複数の検索パターンを試す（正規化なしでそのまま）
      const patterns = [
        address.trim(),                    // 元の入力（トリムのみ）
        cleanAddress(address),            // 余分な空白を削除
        address,                           // 完全にそのまま
      ];

      // 重複を除去
      const uniquePatterns = [...new Set(patterns)];

      for (const pattern of uniquePatterns) {
        if (!pattern) continue;

        try {
          const baseUrl = getApiBaseUrl();
          const url = `${baseUrl}?query=${encodeURIComponent(pattern)}&appid=${encodeURIComponent(yahooApiKey)}&output=json`;

          const response = await fetch(url);

          if (!response.ok) {
            console.error(`HTTPエラー: ${response.status}`);
            continue;
          }

          const data = await response.json();

          // APIエラーの確認
          if (data.Error) {
            console.error('APIエラー:', data.Error);
            // エラーコードに応じて処理を続行
            if (data.Error.Code === 'E01' || data.Error.Code === 'E02') {
              // 認証エラーやパラメータエラーの場合は続行しない
              setResultInfo({
                type: 'error',
                content: `<h3>APIエラー</h3><p>${data.Error.Message || 'APIキーまたはパラメータに問題があります。'}</p>`
              });
              return null;
            }
            continue;
          }

          if (data.Feature && data.Feature.length > 0) {
            // 最初の結果を使用
            const feature = data.Feature[0];
            const geometry = feature.Geometry || {};

            // 座標を取得
            const { lat, lon } = parseCoordinates(geometry.Coordinates);

            if (!lat || !lon) {
              console.warn('座標が取得できませんでした:', feature);
              continue;
            }

            // 住所の表示形式を構築
            const displayAddress = extractAddressFromFeature(feature, address);

            return {
              lat: lat,
              lon: lon,
              name: displayAddress,
              fullResult: feature
            };
          }
        } catch (err) {
          console.error('パターン検索エラー:', err, pattern);

          // CORSエラーまたはネットワークエラーの場合
          if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            // 最初のパターンでCORSエラーが発生した場合は、すべてのパターンで同じエラーになる可能性が高い
            // エラーメッセージを設定してループを抜ける
            setResultInfo({
              type: 'error',
              content: '<h3>CORSエラー</h3><p>ブラウザから直接APIにアクセスできません。<br>開発サーバーのプロキシ設定を確認してください。</p>'
            });
            return null;
          }
          continue;
        }
      }

      // すべてのパターンで見つからなかった場合
      setResultInfo({
        type: 'error',
        content: '<h3>検索結果</h3><p>住所が見つかりませんでした。<br>別の表記で試してみてください。</p>'
      });
      return null;
    } catch (error) {
      console.error('ジオコーディングエラー:', error);
      setResultInfo({
        type: 'error',
        content: `<h3>エラー</h3><p>検索中にエラーが発生しました。<br>${error.message || 'ネットワークエラーの可能性があります。'}</p>`
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // 住所検索の提案を取得
  const getAddressSuggestions = async (query) => {
    if (query.length < 2 || !yahooApiKey) {
      setShowSuggestions(false);
      return;
    }

    try {
      const cleanedQuery = cleanAddress(query);
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}?query=${encodeURIComponent(cleanedQuery)}&appid=${encodeURIComponent(yahooApiKey)}&output=json`;

      const response = await fetch(url);

      if (!response.ok) {
        setShowSuggestions(false);
        return;
      }

      const data = await response.json();

      // APIエラーの確認
      if (data.Error || !data.Feature || data.Feature.length === 0) {
        setShowSuggestions(false);
        return;
      }

      const suggestionList = data.Feature.slice(0, 5).map((feature) => {
        const geometry = feature.Geometry || {};

        // 座標を取得
        const { lat, lon } = parseCoordinates(geometry.Coordinates);

        if (!lat || !lon) return null;

        const displayAddress = extractAddressFromFeature(feature, '住所不明');

        return {
          address: displayAddress,
          lat: lat,
          lon: lon
        };
      }).filter(Boolean);

      setSuggestions(suggestionList);
      setShowSuggestions(suggestionList.length > 0);
    } catch (error) {
      console.error('サジェスト取得エラー:', error);
      setShowSuggestions(false);
    }
  };

  // 住所を検索してマップに追加
  const searchAddress = async (address) => {
    if (!address.trim()) {
      setResultInfo({
        type: 'error',
        content: '<h3>エラー</h3><p>住所を入力してください。</p>'
      });
      return;
    }

    setShowSuggestions(false);

    const result = await geocodeAddress(address);

    if (!result) {
      return;
    }

    // 重複チェック（入力そのままで比較）
    const cleanedInput = cleanAddress(address);
    const isDuplicate = markedAddresses.some(item =>
      cleanAddress(item.address) === cleanedInput || item.address === address
    );
    if (isDuplicate) {
      setResultInfo({
        type: 'error',
        content: '<h3>警告</h3><p>この住所は既に追加されています。</p>'
      });
      setAddressInput('');
      return;
    }

    // 新しいマーカーを追加
    const colorIndex = markedAddresses.length;
    const markerColor = colors[colorIndex % colors.length];

    const newAddress = {
      address: address,
      lat: result.lat,
      lon: result.lon,
      color: markerColor,
      label: '',
      fullResult: result.fullResult
    };

    setMarkedAddresses([...markedAddresses, newAddress]);

    // 結果情報を表示
    const addressParts = result.fullResult?.address || {};
    const detailInfo = addressParts.house_number ? `<p>番地: ${addressParts.house_number}</p>` : '';

    setResultInfo({
      type: 'success',
      content: `
        <h3>✓ 追加しました</h3>
        <p>${address}</p>
      `
    });

    setTimeout(() => {
      setResultInfo({ type: '', content: '' });
    }, 3000);

    setAddressInput('');
  };

  // マップ上の特定の住所を中心にする
  const centerMapOnAddress = (index) => {
    const item = markedAddresses[index];
    if (!mapRef.current || !item) return;
    const zoomLevel = item.fullResult?.address?.house_number ? 18 : 15;
    mapRef.current.setView([item.lat, item.lon], zoomLevel);
  };

  // 住所を削除
  const removeAddress = (index) => {
    const newAddresses = markedAddresses.filter((_, i) => i !== index);
    setMarkedAddresses(newAddresses);
  };

  // ラベルを更新
  const updateLabel = (index, label) => {
    const newAddresses = [...markedAddresses];
    newAddresses[index] = { ...newAddresses[index], label: label };
    setMarkedAddresses(newAddresses);
  };

  // すべての住所をクリア
  const clearAllAddresses = () => {
    if (!window.confirm('すべてのマーカーをクリアしますか？')) return;
    setMarkedAddresses([]);
    setResultInfo({ type: '', content: '' });
  };

  // サジェストをクリック
  const handleSuggestionClick = (suggestion) => {
    setAddressInput(suggestion.address);
    setShowSuggestions(false);
    searchAddress(suggestion.address);
  };

  // 入力変更時のサジェスト取得
  const handleInputChange = (e) => {
    const value = e.target.value;
    setAddressInput(value);
    getAddressSuggestions(value);
  };

  // Enterキーで検索
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchAddress(addressInput);
    }
  };

  // サジェスト外をクリックしたときに非表示
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        const input = document.getElementById('addressInput');
        if (input && !input.contains(event.target)) {
          setShowSuggestions(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div className="container">
      <div className="sidebar">
        <h1>住所マッピング</h1>

        <div className="api-section">
          <h3>API設定</h3>
          <input
            type="password"
            id="apiKeyInput"
            placeholder="Yahoo!ジオコーダ APIキー"
            className="api-key-input"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button onClick={handleSaveApiKey} className="save-api-key-btn">
            保存
          </button>
          {apiStatus.text && (
            <div className={`api-status ${apiStatus.type}`}>
              {apiStatus.text}
            </div>
          )}
        </div>

        <div className="search-section">
          <input
            type="text"
            id="addressInput"
            placeholder="住所を入力（例：東京都渋谷区1-2-3）"
            className="address-input"
            value={addressInput}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          />
          <button
            onClick={() => searchAddress(addressInput)}
            className="search-btn"
            disabled={isLoading}
          >
            {isLoading ? '検索中...' : '追加'}
          </button>
          <div
            ref={suggestionsRef}
            className={`address-suggestions ${showSuggestions ? 'show' : ''}`}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="suggestion-item"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="suggestion-address">{suggestion.address}</div>
              </div>
            ))}
          </div>
        </div>

        {resultInfo.content && (
          <div className={`result-info ${resultInfo.type}`}>
            <div dangerouslySetInnerHTML={{ __html: resultInfo.content }} />
          </div>
        )}

        <div className="marked-addresses">
          <h3>マッピング済み住所 ({markedAddresses.length})</h3>
          <ul className="address-list">
            {markedAddresses.map((item, index) => (
              <li key={index} className="address-item">
                <div
                  className="address-item-color"
                  style={{ backgroundColor: item.color }}
                />
                <div className="address-item-info">
                  <div
                    className="address-item-address"
                    onClick={() => centerMapOnAddress(index)}
                  >
                    {item.address}
                  </div>
                  <input
                    type="text"
                    className="address-item-label"
                    placeholder="ラベルを入力..."
                    value={item.label || ''}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <button
                  className="address-item-btn"
                  onClick={() => removeAddress(index)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
          {markedAddresses.length > 1 && (
            <button onClick={clearAllAddresses} className="clear-all-btn">
              すべてクリア
            </button>
          )}
        </div>
      </div>
      <Map markers={markedAddresses} onMapReady={handleMapReady} />
    </div>
  );
}

export default App;
