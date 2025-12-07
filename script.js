// DOM要素の取得
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const generateBtn = document.getElementById('generateBtn');
const printBtn = document.getElementById('printBtn');
const actionButtons = document.getElementById('actionButtons');
const messageArea = document.getElementById('messageArea');
const cardsContainer = document.getElementById('cardsContainer');

// 選択されたファイル
let selectedFile = null;
let csvData = [];

// ドラッグ＆ドロップイベントの設定
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// ファイル選択イベント
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// 生成ボタンのイベント
generateBtn.addEventListener('click', () => {
    generateCards();
});

// 印刷ボタンのイベント
printBtn.addEventListener('click', () => {
    window.print();
});

/**
 * ファイル処理
 */
function handleFile(file) {
    // CSVファイルかチェック
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('CSVファイルを選択してください');
        return;
    }

    selectedFile = file;
    fileStatus.innerHTML = `<div class="file-item valid">
        <span>📄 ${file.name}</span>
        <span class="file-status status-ok">OK</span>
    </div>`;

    actionButtons.style.display = 'flex';
    clearMessage();

    showSuccess(`${file.name} を読み込みました`);
}

/**
 * CSVファイルを読み込み
 */
async function loadCSV() {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const rows = parseCSV(text);
                resolve(rows);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('ファイル読み込みエラー'));
        };

        // Shift-JISで読み込み（日本語CSVに対応）
        reader.readAsText(selectedFile, 'Shift_JIS');
    });
}

/**
 * CSV文字列をパース
 */
function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const result = [];

    for (let line of lines) {
        if (line.trim() === '') continue;
        const cells = parseCSVLine(line);
        result.push(cells);
    }

    return result;
}

/**
 * CSV行をパース
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

/**
 * キープカードを生成
 */
async function generateCards() {
    if (!selectedFile) {
        showError('ファイルが選択されていません');
        return;
    }

    try {
        clearMessage();
        showMessage('CSVファイルを読み込み中...', 'info');

        // CSVを読み込み
        const rows = await loadCSV();

        if (rows.length < 23) {
            showError('CSVファイルにデータがありません');
            return;
        }

        // ヘッダーは22行目（インデックス21）にある
        const header = rows[21];
        const dataRows = rows.slice(22);

        // 列インデックスを取得
        const drugNameIdx = 4;  // E列：薬品名
        const drugPriceIdx = 6;  // G列：薬価
        const safetyStockIdx = 12;  // M列：安全在庫数量
        const maxOutIdx = 13;  // N列：MAX出庫数量
        const prescriptionCountIdx = 14;  // O列：処方回数
        const patientCountIdx = 15;  // P列：患者数

        // カードデータを作成
        csvData = dataRows
            .filter(row => row.length > Math.max(drugNameIdx, drugPriceIdx, safetyStockIdx, maxOutIdx, prescriptionCountIdx, patientCountIdx))
            .map(row => {
                // M列とN列の値を取得して、大きい方をキープ数とする
                const safetyStock = parseInt(row[safetyStockIdx]) || 0;
                const maxOut = parseInt(row[maxOutIdx]) || 0;
                const keepNumber = Math.max(safetyStock, maxOut);

                return {
                    drugName: row[drugNameIdx],
                    drugPrice: row[drugPriceIdx] || '',
                    keepNumber: keepNumber,
                    safetyStock: safetyStock,
                    maxOut: maxOut,
                    prescriptionCount: row[prescriptionCountIdx] || '',
                    patientCount: row[patientCountIdx] || ''
                };
            })
            .filter(item => item.drugName && item.drugName.trim() !== '' && item.keepNumber > 0);

        if (csvData.length === 0) {
            showError('有効なデータがありません（キープ数が0より大きいデータが必要です）');
            return;
        }

        showMessage('カードを生成中...', 'info');

        // カードをレンダリング
        renderCards();

        // 印刷ボタンを表示
        printBtn.style.display = 'inline-block';

        clearMessage();
        showSuccess(`${csvData.length}枚のカードを生成しました（${Math.ceil(csvData.length / 16)}ページ）`);

        // カードコンテナまでスクロール
        setTimeout(() => {
            cardsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

    } catch (error) {
        showError(`エラーが発生しました: ${error.message}`);
        console.error(error);
    }
}

/**
 * カードをレンダリング（16枚ごとにページを作成）
 */
function renderCards() {
    cardsContainer.innerHTML = '';

    // 16枚ごとにページを作成（A4横 4列×4行）
    const cardsPerPage = 16;
    const totalPages = Math.ceil(csvData.length / cardsPerPage);

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const page = document.createElement('div');
        page.className = 'page';

        const startIdx = pageNum * cardsPerPage;
        const endIdx = Math.min(startIdx + cardsPerPage, csvData.length);

        for (let i = startIdx; i < endIdx; i++) {
            const card = createCard(csvData[i]);
            page.appendChild(card);
        }

        // 最後のページで16枚未満の場合、空のカードで埋める
        if (pageNum === totalPages - 1) {
            const remainingCards = cardsPerPage - (endIdx - startIdx);
            for (let i = 0; i < remainingCards; i++) {
                const emptyCard = document.createElement('div');
                emptyCard.className = 'card empty';
                page.appendChild(emptyCard);
            }
        }

        cardsContainer.appendChild(page);
    }
}

/**
 * 1枚のカードを作成
 */
function createCard(data) {
    const card = document.createElement('div');
    card.className = 'card';

    // 薬価表示用（空の場合は非表示）
    const priceHtml = data.drugPrice ? `<div class="drug-price">薬価: ${data.drugPrice}円</div>` : '';

    // 処方回数・患者数表示用（空の場合は非表示）
    const statsHtml = [];
    if (data.prescriptionCount) {
        statsHtml.push(`処方回数: ${data.prescriptionCount}回`);
    }
    if (data.patientCount) {
        statsHtml.push(`患者数: ${data.patientCount}人`);
    }
    const statsDisplay = statsHtml.length > 0 ? `<div class="drug-stats">${statsHtml.join(' / ')}</div>` : '';

    card.innerHTML = `
        <div class="card-inner">
            <div class="card-header">
                <div class="card-title">${escapeHtml(data.drugName)}</div>
                ${priceHtml}
            </div>
            <div class="card-body">
                <div class="keep-label">キープ数</div>
                <div class="keep-value">${data.keepNumber.toLocaleString()}</div>
            </div>
            <div class="card-footer">
                ${statsDisplay}
                <div class="decoration-line"></div>
            </div>
        </div>
    `;

    return card;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * メッセージ表示関数
 */
function showMessage(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = message;
    messageArea.appendChild(div);
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function clearMessage() {
    messageArea.innerHTML = '';
}
