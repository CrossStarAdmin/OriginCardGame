// カードごとの被写体。en が実際にAPIへ送る文で、jp は人が読んで確認するための対訳
// 両方を必ず揃えて直す。ずれていると review.js の突き合わせで気づけなくなる
// CHARACTERS は複数カードに登場する人物の外見を1か所に固定するための定義
// 中身は バックエンドストーリー/ の設定を元にしている

const CHARACTERS = {
  'リーゼ': {
    jp: 'リーゼ。20代の焔術士の女性。毛先が不揃いに焼け焦げた短い緋色の髪、鋭い琥珀色の目。実用的な革の上に焦げた黒と深紅のマント。剥き出しの前腕に古い火傷の痕。もう火の消し方を知らない女',
    en: 'Liese, a fire sorceress in her twenties, short scarlet hair burnt unevenly at the ends, sharp amber eyes, a scorched black-and-crimson mantle over practical leather, bare forearms marked with old burn scars, a woman who no longer knows how to put a fire out',
  },
  '師ベルゼ': {
    jp: '師ベルゼ。痩せ細った老焔術士。長い白髯と深く皺の刻まれた顔、裾の焦げた灰色のローブ。望まぬ炎が両手から溢れ出す中、抑えきれない悲嘆の表情',
    en: 'Master Berze, a gaunt old fire-magus with a long white beard and a deeply lined face, ash-grey robes scorched at the hem, an expression of grief he cannot control while fire he never wanted pours off his hands',
  },
  'ヴェルド': {
    jp: '憤怒のヴェルド。背が高く痩身の魔族。ひび割れた黒曜石の肌の裂け目が溶岩色に光る。後方へ流れた2本の角、焼け焦げたぼろ布。穏やかで、どこか感嘆すら含んだ微笑',
    en: 'Verd the demon of Wrath, a tall lean demon with cracked obsidian skin glowing molten in the fissures, two swept-back horns, a serene almost admiring smile, wearing burnt tatters',
  },
  'エルナ': {
    jp: 'エルナ。20代の星詠みの女性。長い灰みがかった金髪、淡い灰色の目。深い藍色の星図用コート、腰に真鍮のアストロラーベの環。物静かで慎重。怖がりでありながら、それでも星を読む女',
    en: 'Erna, a star-reader in her twenties, long ash-blonde hair, pale grey eyes, a deep indigo star-charting coat with brass astrolabe rings at her belt, quiet and careful, a woman who is afraid and reads anyway',
  },
  '相棒ヴァルザ': {
    jp: 'ヴァルザ。40代の痩せた男性研究者。後ろで束ねた黒髪、丸眼鏡、袖をまくった藍色の学者コート、インクで汚れた指。屈託のない自信に満ちた笑み',
    en: 'Valza, a lean male researcher in his forties, dark hair tied back, round spectacles, an indigo scholar coat with rolled sleeves and ink-stained fingers, an easy confident grin',
  },
  '識りすぎたヴァルザ': {
    jp: 'ヴァルザの成れの果て。巨大な唸る結晶と融合し、かろうじて人の形を保つ姿。四肢は結晶へと伸び広がり、瞼を失った目は二度と閉じない。無数の幽かな星座の記号が体から空へ流れ出す',
    en: 'what Valza became: a barely human figure fused to a vast humming crystal, limbs stretched into crystalline growths, eyelids gone so the eyes can never close, dozens of ghostly star-glyphs streaming out of him into the sky',
  },
  'ノクス': {
    jp: '傲慢のノクス。立襟の菫色のコートを着た優雅な魔族。王冠のような銀の角。片手を、星光を溢れさせる開かれた本に置き、丁重な侮蔑をもって見下ろす',
    en: 'Nox the demon of Pride, an elegant demon in a high-collared violet coat, silver horns like a crown, one hand resting on an open book whose pages pour starlight, looking down with polite contempt',
  },
  'アルベル': {
    jp: 'アルベル。30代の司祭の男性。黒髪、疲れを帯びた優しい目。装飾のない象牙色と灰色の祭服。腰に治療用の鞄と名簿の束。頭を下げることに慣れた男',
    en: 'Albel, a priest in his thirties, dark hair, tired kind eyes, plain ivory-and-grey vestments without ornament, a healer satchel and a bundle of name-lists at his hip, a man used to bowing his head',
  },
  'ザキエル': {
    jp: 'ザキエル。肩幅の広い聖騎士。短く刈った金髪と穏やかな顔立ち。手入れの行き届いた淡い金縁の鎧。抜いた剣を恐ろしいほど優しく下げ持ち、なお自分が善いことをしていると信じている',
    en: 'Zakiel, a broad-shouldered paladin with cropped fair hair and a gentle face, pale gold-trimmed armour kept immaculate, holding a drawn sword low with terrible gentleness, still convinced he is being kind',
  },
  'ミゼリア': {
    jp: '偽善のミゼリア。流れるような白と金の聖職者の衣をまとった細身の魔族。繊細な黒い角。祝福するように両手を組み、目まで届かない温かく慈悲深い微笑を浮かべる',
    en: 'Miseria the demon of Hypocrisy, a slender demon in flowing white-and-gold clerical robes, delicate dark horns, hands clasped as if in blessing, a warm compassionate smile that does not reach the eyes',
  },
};

// character 付きのカードは上の人物設定を差し込み、scene にそのカードでの状況だけを書く
const SUBJECTS = {
  // ---- アグロリーゼ（焔術士）----
  'リーゼ': {
    character: 'リーゼ',
    jp: '燃える街路に立ち、片手を掲げてその手を炎が包む。火の粉が脇を流れていく。自分が焼いているものから目を逸らさない',
    en: 'she stands amid a burning street, one hand raised and wreathed in fire, embers streaming past her, refusing to look away from what she is burning',
  },
  '学舎の見習い': {
    jp: '煤で汚れた学舎の制服を着た若い成人の見習い焔術士。両手で包むように小さな不安定な炎を持ち、眉を寄せて集中している',
    en: 'a young adult apprentice fire-mage in a soot-smudged academy uniform, holding a small unsteady flame in both cupped hands, brow furrowed in concentration',
  },
  '火の子': {
    jp: '生きた炎でできた小さな精霊の子。野生的な笑顔で、火の塊を前方へ投げつけ、火花を引いている',
    en: 'a small elemental child made of living flame, wild grinning face, flinging a fistful of fire forward, trailing sparks',
  },
  '火の粉': {
    jp: '投げられた一粒の火花が小さな炎の矢となって、煙る暗い空気の中を弧を描いて飛ぶ。その航跡に細かい燃え殻が散る',
    en: 'a single thrown spark blooming into a small dart of fire, arcing through dark smoky air, tiny cinders scattering in its wake',
  },
  'マルカ': {
    jp: 'マルカ。焔術士の家の落ち着いた体格の良い姉。焦げた重い鉄の鍋蓋を盾に構え、見えない誰かの前に立ちはだかる。食いしばった顎',
    en: 'Marka, a broad calm older sister of a fire-mage family, a heavy scorched iron pot-lid raised as a shield, planting herself in front of someone unseen, jaw set',
  },
  'ポルカ': {
    jp: 'ポルカ。頬に煤をつけた素早い小柄な焔術士の子。両手から炎を引きながら走って跳び出し、笑っている',
    en: 'Polka, a small quick fire-mage child with soot on her cheeks, launched forward in a running leap with flame trailing from both hands, laughing',
  },
  'ギズモ': {
    jp: 'ギズモ。継ぎ接ぎのコートを着た荒っぽい若い焔術士。低い姿勢で駆けながら、すでに火球を灯して投げる構えに腕を振りかぶっている',
    en: 'Gizmo, a scrappy young fire-mage in a patched coat, sprinting low with a fireball already lit and swinging back to throw',
  },
  '焔弾': {
    jp: '圧縮された白熱の炎の球が砲弾のように撃ち出され、背後の煙に衝撃波の輪を穿つ',
    en: 'a compressed sphere of white-hot flame fired like a cannonball, punching a shockwave ring through the smoke behind it',
  },
  '老師ハルド': {
    jp: '老師ハルド。灰色の髯と杖を持つがっしりした老焔術士。片腕を振り上げて人々を前へ鼓舞し、周囲に暖かい炎の光が噴き上がる',
    en: 'Elder Hald, a stout old fire-magus with a grey beard and a staff, one arm thrown up to rally people forward, warm firelight bursting up around him',
  },
  '火口の洞守り': {
    jp: '火山岩の重厚な鎧をまとった火口の洞の番人。何かを押し止めるため巨大な玄武岩の板を裂け目に嵌め込む。割れ目から溶岩が光る',
    en: 'a crater-cave warden in heavy volcanic-stone armour, wedging a great slab of basalt into a fissure to hold something back, lava glowing through the cracks',
  },
  '焼き払い': {
    jp: '轟音を立てる炎の壁が地表を薙ぎ払い、広い面の火となってすべてを呑み込む。瓦礫が影となって吹き上がる',
    en: 'a wall of roaring flame sweeping across the ground and consuming everything in a wide sheet of fire, silhouetted debris flung upward',
  },
  'ドロテ': {
    jp: 'ドロテ。長身で獰猛な炎の女剣士。上昇気流に髪をなびかせ、全体を炎に包まれた刃を構えて突進する。歩幅の後ろに炎の航跡',
    en: 'Dorote, a tall fierce fire-swordswoman, hair whipping in the updraft, charging with a blade sheathed entirely in flame, a trail of fire behind her stride',
  },
  'ヴェルド': {
    character: 'ヴェルド',
    jp: '夕暮れの焼け落ちた町の広場に立ち、両腕を広げ、その廃墟をまるで芸術作品のように眺めている',
    en: 'he stands in a burnt-out town square at dusk, arms spread, admiring the ruin as if it were a work of art',
  },
  '消えぬ焔': {
    jp: '地面から夜空へ噴き上がる巨大な消えぬ炎の柱。そこから小さな炎が外へ跳び、野全体に燃え移っていく',
    en: 'an enormous undying pillar of fire erupting from the ground into the night sky, smaller flames leaping outward from it to ignite the whole field',
  },
  '師ベルゼ': {
    character: '師ベルゼ',
    jp: '自分では止められない火災旋風の中心に立ち、両腕を広げる。背後で自らの町が白く燃えている',
    en: 'he stands at the heart of a firestorm he cannot stop, arms outstretched, his own town burning white behind him',
  },

  // ---- ミッドレンジ奇数エルナ（星詠み）----
  'エルナ': {
    character: 'エルナ',
    jp: '掲げた手の周りを星座の記号の輪が回り、夜空を読む。目に星明かりが映り込む',
    en: 'she reads the night sky with a floating ring of constellation glyphs turning around her raised hand, starlight reflected in her eyes',
  },
  'オルレアの民': {
    jp: '藍色のフード付き外套を着た天文台の町の住人。小さな真鍮の星時計を掲げ、夜空を見上げる',
    en: 'a townsfolk of the observatory town in a hooded indigo cloak, holding up a small brass star-dial, looking up at the night sky',
  },
  '使い魔サキュ': {
    jp: 'サキュ。猫と夜の蛾を掛け合わせたような小さな有翼の使い魔。星屑を散らした毛並み。開いた星図の巻物を前脚に抱えて油断なく止まっている',
    en: 'Saku, a small winged familiar like a cat crossed with a night moth, star-flecked fur, perched alert with an open star-chart scroll in its paws',
  },
  '凶兆のまたたき': {
    jp: '凶兆の星明かりのゆらぎが、目の落ち窪んだ小さな霊の形をとる。背後で星がひとつ消えかけ、空の傷から細い菫色の光が漏れる',
    en: 'an ill-omened flicker of starlight taking the shape of a small hollow-eyed spirit, a single star guttering out behind it, thin violet light bleeding from the wound in the sky',
  },
  '一手先を読む': {
    jp: '星座の記号が格子状に並ぶ中を、一手先へ光る線をなぞる手。なぞられた道筋だけが他より先に灯る',
    en: 'a hand tracing a glowing line one step ahead through a lattice of constellation glyphs, the traced path lighting up before the rest',
  },
  '夜番の観測者': {
    jp: '天文台のバルコニーに立つ夜番の観測者。肩に長い真鍮の望遠鏡、足元にランタン。空を掃くように見渡している',
    en: 'a night-watch observer on an observatory balcony, a long brass telescope on their shoulder, a lantern at their feet, sweeping the sky',
  },
  '守り役オルド': {
    jp: 'オルド。星図を打ち出した鎧をまとった恰幅の良い老守護者。大きなタワーシールドを地に据え、両手で支えて微動だにしない',
    en: 'Ordo, a heavy-set old guardian in star-chart-embossed plate, a broad tower shield planted and both hands braced on it, unmoving',
  },
  '姉マイア': {
    jp: 'マイア。長い黒髪と温かく落ち着いた表情の姉の星詠み。両腕を掲げ、降り注ぐ流星を呼び下ろす',
    en: 'Maia, an elder sister star-reader with long dark hair and a warm steady expression, both arms raised to call down a scattering of falling stars',
  },
  '相棒ヴァルザ': {
    character: '相棒ヴァルザ',
    jp: '雑然とした天文台の机に身を乗り出し、片手を開いた星図に置いたまま、肩越しに同僚を振り返ってにやりと笑う',
    en: 'he leans over a cluttered observatory desk, one hand on an open star-atlas, grinning back over his shoulder at a colleague',
  },
  '深読み': {
    jp: '渦巻く星座の奔流に両手を突き入れる読み手。深部の記号が菫色に燃え上がり、星光の閃光が撃ち出される',
    en: 'a reader plunging both hands into a churning vortex of constellations, the deeper glyphs blazing violet, a bolt of starlight lancing out',
  },
  '写し手ヨナ': {
    jp: 'ヨナ。宙に浮かぶ紙に囲まれた若い写し手。羽ペンを手に、空の星座を羊皮紙へ写し取る。その紙面から薄い人影が立ち上がる',
    en: 'Yona, a young transcriber surrounded by floating pages, quill in hand, copying a constellation off the sky onto parchment while a faint traced figure rises from the page',
  },
  '天文台の護り': {
    jp: '真鍮と石でできた天文台の巨大な鎧の守護者。胸に嵌め込まれたアストロラーベの環がゆっくり回る。戸口を塞いで踏ん張っている',
    en: 'a colossal armoured guardian of the observatory, brass and stone, an astrolabe ring set in its chest turning slowly, standing braced across a doorway',
  },
  '双つの未来': {
    jp: 'ひとりの人物が同じ姿の半透明な二人へ分かれ、それぞれ別の方向へ踏み出す。二人とも星光の輪郭を帯び、片方がわずかに先を行く',
    en: 'a single figure split into two identical translucent selves stepping apart in different directions, both outlined in starlight, one slightly ahead of the other',
  },
  '識りすぎたヴァルザ': {
    character: '識りすぎたヴァルザ',
    jp: '天文台の地下、水に満ちた結晶の間に浮かび、見えたものすべてを光で空に書き出している',
    en: 'he floats in the flooded crystal chamber beneath the observatory, writing everything he sees across the sky in light',
  },
  '傲慢のノクス': {
    character: 'ノクス',
    jp: '天文台のドームの頂に立ち、掌の上で本を燃え上がらせる。星座が彼の思うままに並び替わっていく',
    en: 'he stands atop the observatory dome with the open book blazing in his palm, the constellations rearranging themselves to suit him',
  },

  // ---- コントロールアルベル（司祭）----
  'アルベル': {
    character: 'アルベル',
    jp: 'ランプの灯る施療院に立ち、片手を掲げてゆっくりとした治癒の光を灯す。疲れ切ってなお揺るがない',
    en: 'he stands in a lamplit infirmary with one hand raised in a slow healing light, exhausted and unwavering',
  },
  '癒しの人形ホミ': {
    jp: 'ホミ。淡い白い光で動く、縫い目の見える小さな布人形。腕に小さな包帯を巻き、短い両手を伸ばして癒しを差し出す',
    en: 'Homi, a small stitched cloth doll animated by faint white light, a tiny bandage tied around its arm, reaching up with both stubby hands to offer healing',
  },
  '小さな手当て': {
    jp: '傷ついた前腕に清潔な包帯を丁寧に巻く手。布の下から柔らかく暖かい光が広がる',
    en: 'careful hands winding a clean bandage around a wounded forearm, a soft warm glow spreading out from under the cloth',
  },
  '間に合わせの蘇生': {
    jp: '明滅する不安定な淡い光の輪の中で、辛うじて蘇った体が起き上がる。その光はすでに尽きかけ、ひび割れている',
    en: 'a barely-revived body lurching upright inside a flickering, unstable ring of pale light, the light already guttering and cracking',
  },
  '傷ついた巡礼者': {
    jp: '破れた旅装の傷ついた巡礼者。片腕を血の滲む三角巾で吊り、もう一方の腕で使い込んだ木の盾を掲げ、退こうとしない',
    en: 'a wounded pilgrim in a torn travelling cloak, one arm in a bloodied sling, raising a battered wooden shield with the other and refusing to step aside',
  },
  '長屋の病人': {
    jp: '藁の寝台の上で身を起こす病んだ町人。肩に毛布を掛け、胸元に淡い治癒の光が集まる。それでも頑なに生きている',
    en: 'a sick townsperson sitting up on a straw infirmary cot, a blanket over their shoulders, faint healing light gathering at their chest, stubbornly alive',
  },
  '修道女キーラ': {
    jp: 'キーラ。灰色の修道服に小さな円盾を持つ若い修道女。片腕を伸ばして背後の誰かを庇い、空いた手から柔らかい守りの後光が広がる',
    en: 'Sister Kira, a young nun in a grey habit with a small round shield, one arm out to shelter someone behind her, a soft protective halo spreading from her free hand',
  },
  '記録を繰る': {
    jp: '鎖で繋がれた巨大な書庫の写本のページを繰る手。紙が舞い上がって宙に留まり、光る文字が紙面から浮き上がる',
    en: 'hands turning the pages of a huge chained archive tome, pages flying up and hanging in the air, glowing script lifting off them',
  },
  '聖獣キメラ': {
    jp: '聖なるキメラ。獅子の体に山羊の第二の頭と羽毛の鷲の翼を持つ巨獣。たてがみに沿って淡い金の光が燃え、咆哮している',
    en: 'a holy chimera, a great lion-bodied beast with a second goat head and feathered eagle wings, pale gold light burning along its mane, roaring',
  },
  '聖騎士ザキエル': {
    character: 'ザキエル',
    jp: 'ランプの灯る施療院の寝台の上に立ち、剣を抜いて下げ持つ。顔は憐れみに満ちている',
    en: 'he stands over an infirmary cot in the lamplight, sword drawn and lowered, his face full of pity',
  },
  '老司祭ドラン': {
    jp: 'ドラン司祭。香炉とランタンを持つ腰の曲がった老司祭。祝福を唱えながら、若い侍者を光の中へ手招きしている',
    en: 'Father Doran, a stooped old priest with a censer and a lantern, beckoning a younger acolyte forward into the light with a blessing on his lips',
  },
  '祈る巡礼者': {
    jp: '頭を垂れ両手を組んで跪き祈る巡礼者。そこから白い光の輪が地表へ広がっていく',
    en: 'a pilgrim kneeling in prayer with head bowed and hands clasped, a widening ring of white light bursting outward from them across the ground',
  },
  '継ぐ者の儀': {
    jp: '蝋燭の灯る儀式。棺台に横たわる布に包まれた遺体が光の粒へと解け、その両脇に薄い人影が二つ立ち上がる',
    en: 'a candlelit rite: a shrouded body on a bier dissolving into motes of light while two faint figures rise on either side of it',
  },
  '偽善のミゼリア': {
    character: 'ミゼリア',
    jp: '崩れた礼拝堂に立ち、祝福するように両腕を開く。そこから洗い流すような白い光の波が押し寄せる',
    en: 'she stands in a ruined chapel with arms opened in benediction, a wave of scouring white light sweeping out from her',
  },
  '継承の大鐘': {
    jp: '経文の浮き彫りに覆われた、古びた青銅の巨大な聖堂の鐘。吊られたまま振れる途中で、その音の衝撃波が空気を波打たせて見える',
    en: 'a colossal cathedral bell of aged bronze, covered in scripture reliefs, suspended and mid-swing, the shockwave of its toll rippling visibly through the air',
  },
};

module.exports = { CHARACTERS, SUBJECTS };
