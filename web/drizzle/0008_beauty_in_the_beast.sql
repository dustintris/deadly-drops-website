-- Beauty in the Beast (Feb 20–21, 2027), the club's first tournament of 2027, from Cherry's announcement and flyer:
-- a charity day on Saturday and the Men's Moneyball on Sunday. Added once, and only if no tournament has this web
-- address yet, so a copy the owner already made (or edits later in Admin → Tournaments) is never touched.
-- Not featured: VICTORY holds the one featured spot, and the site leads with the next upcoming tournament anyway.
-- Divisions and start times are added in the admin once they're set; the Main Court link when registration opens.
INSERT INTO "tournaments" ("slug", "name", "days", "info", "rules", "featured", "visible")
SELECT
  'beauty-in-the-beast-2027',
  'Beauty in the Beast',
  ARRAY['2027-02-20', '2027-02-21']::date[],
  jsonb_build_object(
    'summary', 'Kick off 2027 with our first charity tournament of the year: a hybrid weekend with a Charity Tournament for local animals on Saturday and the Men’s Moneyball Showdown on Sunday.',
    'dateLabel', 'Feb 20–21, 2027',
    'startTime', '08:00',
    'venue', 'Better at Pickleball, 2800 Olympic Parkway, Chula Vista, CA',
    'entryFee', 65,
    'includes', jsonb_build_array(
      'Pickle meal (charity day)',
      'Boba drink (charity day)',
      'Commemorative keychain (charity day)',
      'Raffle prizes',
      'Moneyball cash prizes up to $300'
    ),
    'format', 'Sat: charity round robin by age and DUPR, 7 games to 11. Sun: Men’s Moneyball, 5 pool games, then playoffs.',
    'prizes', jsonb_build_array(),
    'registrationOpen', false,
    'flyer', jsonb_build_object(
      'src', '/images/club/beauty-in-the-beast-flyer.jpg',
      'alt', 'Beauty in the Beast Hybrid flyer: Feb 20 charity event and Feb 21 Men’s Money Ball at Better at Pickleball, $65 entry, divisions and prize payouts'
    )
  ),
  jsonb_build_object(
    'gamesTo', 11,
    'winBy2', false,
    'gamesPerTeam', 7,
    -- "Standings: determined by total wins. Ties are broken by the highest total points scored."
    'tiebreakers', jsonb_build_array('pointsFor'),
    'playoffGamesTo', 15,
    'notes', jsonb_build_array(
      jsonb_build_object('id', 'charity-event', 'title', 'Charity Event · Saturday, Feb 20', 'text',
        'Play for a purpose. Whether you’re a seasoned player or brand new to competitive pickleball, the Charity Event is a welcoming, low-pressure way to feel real tournament energy. Divisions are organized by age bracket (30+, 40+, 50+, 60+, 70+) and DUPR level (2.5, 3.0, 3.5) in Women’s, Men’s and Mixed doubles, so you play peers who match your pace, experience and stamina. Guaranteed 7 round-robin games (no high-pressure playoffs): games to 11, win by 1, with a 2-hour 15-minute window per division. All charity proceeds support an animal sanctuary and/or an animal rescue and neglect foundation.'),
      jsonb_build_object('id', 'player-perks', 'title', 'Player perks', 'text',
        'Every charity registration ($65) includes a pickle meal, a boba drink and a commemorative keychain, picked up at check-in, plus a shot at our raffle prizes. Grab extra treats all day from our official event vendors, Halo-Halo and Cups & Straws.'),
      jsonb_build_object('id', 'dethrone-the-queens', 'title', 'Dethrone the Queens', 'text',
        'Think you have what it takes to beat the reigning Queens of the Court from our VICTORY Breast Cancer/Halloween tournament? Defeat them in their divisions and levels to claim the crown, and earn free registration to defend your title at our next charity event.'),
      jsonb_build_object('id', 'moneyball', 'title', 'Moneyball · Sunday, Feb 21', 'text',
        'The Kings of the Animal Kingdom. Ready to prove your prowess on the court? Step up for our competitive men’s cash-prize division: Men’s doubles only, in 3.0, 3.5, 4.0 and 4.5 divisions. Players without a DUPR rating are placed in 4.5, and DUPR is rechecked at check-in. Entry is $65 per player (no meals, boba or keychains). Up to 16 teams per division, 3 hours per division, and divisions are never combined. Format: 5 round-robin games across two pools. The top 4 teams from each pool advance to a 1-game semifinal, with the top 2 teams from each semifinal facing off in the finals.'),
      jsonb_build_object('id', 'moneyball-prizes', 'title', 'Moneyball cash prizes & medals', 'text',
        'Full divisions (16 teams): Champions (black medal) $300 plus free entry into the next DDP Moneyball tournament · Gold $200 · Silver $150 · Bronze $100. Divisions of 15 teams or fewer: Gold $300 · Silver $200 · Bronze $100.'),
      jsonb_build_object('id', 'check-in', 'title', 'Check-in', 'text',
        'Please arrive 30 minutes before your division’s start time.'),
      jsonb_build_object('id', 'pickle-meal', 'title', 'Pickle meal', 'text',
        'Email Cherry at deadlydropspickleball@gmail.com before the event to choose your pickle meal.'),
      jsonb_build_object('id', 'standings-ties', 'title', 'Standings & ties', 'text',
        'Standings are decided by total wins. Ties are broken by the highest total points scored.'),
      jsonb_build_object('id', 'division-merging', 'title', 'Division merging', 'text',
        'Underfilled age brackets may be combined for play, but medals are still awarded separately for each original division and age group.'),
      jsonb_build_object('id', 'substitutions', 'title', 'Substitutions & sportsmanship', 'text',
        'No player substitutions are permitted, including for injury. Players are expected to respect each other’s line calls.'),
      jsonb_build_object('id', 'official-ball', 'title', 'Official ball', 'text',
        'To be announced.'),
      jsonb_build_object('id', 'stay-connected', 'title', 'Stay connected', 'text',
        'For event updates and schedules, follow the Deadly Drops Pickleball Facebook page or visit deadlydropspickleball.com. Thank you for supporting our community and local animals. See you on the courts!')
    )
  ),
  false,
  true
WHERE NOT EXISTS (SELECT 1 FROM "tournaments" WHERE "slug" = 'beauty-in-the-beast-2027');
