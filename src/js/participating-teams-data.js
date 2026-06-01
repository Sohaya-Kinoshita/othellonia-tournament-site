window.participatingTeams = [
  {
    team_name: "OP",
    leader_name: "お嬢",
    subleader_name: "れ",
    thumbnail: "./images/teamLists/thumbnails/OP.png",
    image: "./images/teamLists/OP.png",
  },
  {
    team_name: "塩麺極道",
    leader_name: "れおん",
    subleader_name: "Nの人",
  },
  {
    team_name: "醤油しか勝たん",
    leader_name: "しの@志天",
    subleader_name: "LITO",
  },
  {
    team_name: "愛瑠くん以外バリカタ",
    leader_name: "たらちゃん",
    subleader_name: "愛瑠",
  },
];

// デフォルト画像を割り当て（個別画像未指定時に使用）
window.participatingTeams.forEach(function (t) {
  if (!t.thumbnail) t.thumbnail = "./images/teamLists/thumbnails/demo1.png";
  if (!t.image) t.image = "./images/teamLists/demo1.png";
});
