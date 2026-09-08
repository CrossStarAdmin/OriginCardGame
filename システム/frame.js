// カード枠に関わる値
// カードフレーム/frame.json のアート窓の比から決めている。枠を差し替えたら測り直す
const ASPECT = { 'リーダー': '4:5', 'キャラクター': '4:5', 'スペル': '4:5', '武器': '4:5' };

const aspectOf = (type) => ASPECT[type] || '4:5';

module.exports = { ASPECT, aspectOf };
