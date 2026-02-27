-- サンプルチームを追加
INSERT INTO teams
    (teamId, teamName, leaderId, wins, matches)
VALUES
    ('team_001', 'チームA', '100000000001', 0, 0),
    ('team_002', 'チームB', '100000000002', 0, 0),
    ('team_003', 'チームC', '100000000003', 0, 0);

-- サンプルプレイヤーを追加
INSERT INTO players
    (playerId, playerName, teamId1, teamId2, wins, matches)
VALUES
    ('100000000001', 'プレイヤー1', 'team_001', NULL, 0, 0),
    ('100000000002', 'プレイヤー2', 'team_002', NULL, 0, 0),
    ('100000000003', 'プレイヤー3', 'team_003', NULL, 0, 0),
    ('100000000004', 'プレイヤー4', 'team_001', 'team_002', 0, 0),
    ('100000000005', 'プレイヤー5', 'team_002', 'team_003', 0, 0);
