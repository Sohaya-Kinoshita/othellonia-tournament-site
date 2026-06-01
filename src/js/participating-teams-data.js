window.participatingTeams = [
  {
    team_name: "祝みそきん新店舗",
    leader_name: "こーだゐ",
    subleader_name: "JTA",
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
  if (!t.image) t.image = "./images/teamList/demo1_thumbnail.png";
});
