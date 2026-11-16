import { describe, expect, it } from 'vitest'
import { parsePastedTeams, parseTeams } from './pasteTeams'

const TAB = '\t'
const rows = (...lines: string[][]) => lines.map((l) => l.join(TAB)).join('\n')

describe('parsePastedTeams', () => {
  it('reads one team per row with team name and ratings', () => {
    const { teams, unpaired } = parsePastedTeams(
      rows(
        ['Team Name', 'Player 1', 'DUPR', 'Player 2', 'DUPR'],
        ['Net Ninjas', 'Carla Reyes', '3.52', 'Tom Nguyen', '3.48'],
        ['', 'Priya Shah', 'NR', 'Marcus Lee', '3.40'],
      ),
    )
    expect(unpaired).toBeNull()
    expect(teams).toEqual([
      {
        name: 'Net Ninjas',
        players: [
          { name: 'Carla Reyes', dupr: '3.52' },
          { name: 'Tom Nguyen', dupr: '3.48' },
        ],
      },
      {
        name: '',
        players: [
          { name: 'Priya Shah', dupr: 'NR' },
          { name: 'Marcus Lee', dupr: '3.40' },
        ],
      },
    ])
  })

  it('reads the Victory sheet layout: one player per row with 1a / 1b tags', () => {
    const { teams } = parsePastedTeams(
      rows(
        ['1a', 'Net Ninjas', 'Carla Reyes', '3.52'],
        ['1b', '', 'Tom Nguyen', '3.48'],
        ['2a', 'Dink Dynasty', 'Priya Shah', 'nr'],
        ['2b', '', 'Marcus Lee', '3.4'],
      ),
    )
    expect(teams.map((t) => t.name)).toEqual(['Net Ninjas', 'Dink Dynasty'])
    expect(teams[0].players.map((p) => p.name)).toEqual(['Carla Reyes', 'Tom Nguyen'])
    expect(teams[1].players.map((p) => p.dupr)).toEqual(['NR', '3.4'])
  })

  it('pairs plain name-per-line lists and reports an odd one out', () => {
    const { teams, unpaired } = parsePastedTeams('Carla Reyes\nTom Nguyen\nPriya Shah')
    expect(teams).toHaveLength(1)
    expect(teams[0].players.map((p) => p.name)).toEqual(['Carla Reyes', 'Tom Nguyen'])
    expect(unpaired).toBe('Priya Shah')
  })

  it('splits "A / B" and "A & B" cells into two players', () => {
    const { teams } = parsePastedTeams('Carla Reyes / Tom Nguyen\nPriya Shah & Marcus Lee')
    expect(teams.map((t) => t.players.map((p) => p.name))).toEqual([
      ['Carla Reyes', 'Tom Nguyen'],
      ['Priya Shah', 'Marcus Lee'],
    ])
  })

  it('ignores division labels, emails, phones, sizes and fees from a sign-up sheet', () => {
    const { teams } = parsePastedTeams(
      rows([
        'Carla Reyes',
        'carla@example.com',
        '619-555-0100',
        'Tom Nguyen',
        'Mixed 3.5',
        'XL',
        '$55',
        '3.52',
      ]),
    )
    expect(teams).toHaveLength(1)
    expect(teams[0]).toEqual({
      name: '',
      players: [
        { name: 'Carla Reyes', dupr: '3.52' },
        { name: 'Tom Nguyen', dupr: '' },
      ],
    })
  })

  it('accepts comma-separated text when there are no tabs', () => {
    const { teams } = parsePastedTeams('Net Ninjas, Carla Reyes, Tom Nguyen')
    expect(teams[0].name).toBe('Net Ninjas')
    expect(teams[0].players.map((p) => p.name)).toEqual(['Carla Reyes', 'Tom Nguyen'])
  })

  it('returns nothing for blank or header-only text', () => {
    expect(parsePastedTeams('').teams).toEqual([])
    expect(parsePastedTeams(rows(['Team', 'Names', 'DUPR'])).teams).toEqual([])
  })
})

describe('parseTeams', () => {
  it('returns just the teams', () => {
    expect(parseTeams('Ana Cruz & Ben Ruiz')).toEqual([
      {
        name: '',
        players: [
          { name: 'Ana Cruz', dupr: '' },
          { name: 'Ben Ruiz', dupr: '' },
        ],
      },
    ])
  })
  it('handles empty text', () => {
    expect(parseTeams('')).toEqual([])
  })
})
