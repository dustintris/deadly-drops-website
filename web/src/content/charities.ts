/**
 * The charities the club's tournaments play for (Admin → Charities). Starting content: the owner edits
 * these and uploads each charity's flyer in the admin.
 *   Us4Warriors: story as the charity wrote it (Nov 2026).
 *   Breast Cancer Angels: written from breastcancerangels.org (home, About, How we help and Financial
 *   assistance pages, retrieved Nov 2026). Facts only, no figures beyond what the site states.
 */
import type { CharityT } from '@/lib/content-schema'

export const charities: CharityT[] = [
  {
    id: 'charity-us4warriors',
    slug: 'us4warriors',
    name: 'Us4Warriors',
    tagline: 'Standing Together for Those Who Serve',
    summary:
      'An award-winning, volunteer-based 501(c)(3) nonprofit helping active-duty military members, veterans and their families overcome hardship, including food support across San Diego County.',
    story: [
      'At Us4Warriors, we believe those who serve our nation deserve a community that stands beside them. The Us for Warriors Foundation is an award-winning, volunteer-based 501(c)(3) nonprofit dedicated to helping active-duty military members, veterans, and their families overcome hardship and improve their quality of life. Through the commitment of veterans, volunteers, and community supporters, we help military families build stability, strengthen their independence, and pursue a brighter future.',
      'Our mission comes to life through practical assistance and caring connections. Across San Diego County, our Food4Warriors programs help address food insecurity through food distributions, fresh produce, emergency pantry assistance, and support for veterans experiencing homelessness. These efforts help ease immediate burdens while treating those we serve with dignity and respect. Every distribution is an opportunity to remind a military family that their community cares.',
      'You can be part of that commitment. Whether you give your time, make a donation, or become a community partner, your support helps Us4Warriors continue serving those who have given so much. Visit Us4Warriors.org to learn how you can help turn gratitude into action—and help warriors and their families move forward with hope.',
      // signed as in the text the club sent
      '— Danny Shaffsta',
    ].join('\n\n'),
    // us4warriors.org redirects here
    website: 'https://www.us4warriors.org',
    tournaments: ['dominate-2026'],
  },
  {
    id: 'charity-breast-cancer-angels',
    slug: 'breast-cancer-angels',
    name: 'Breast Cancer Angels',
    tagline: 'Improving the lives of all affected by breast cancer',
    summary:
      'A local 501(c)(3) nonprofit giving financial and emotional help to breast cancer patients and their families in Southern California, so no patient has to choose between treatment and food.',
    story: [
      'Breast Cancer Angels is a local, independent 501(c)(3) nonprofit. Its mission is to provide financial and emotional assistance for breast cancer patients and their families, so that no breast cancer patient is forced to make the decision between treatment and food.',
      'Help goes to patients facing financial hardship because of their treatment, in Orange County, the South Bay, San Diego, Los Angeles and parts of the Inland Empire. Once eligible, patients can receive gift cards for groceries, gas and transportation, help with rent or mortgage payments and utility bills, and medical co-pays, along with a social worker who helps them find other resources and offers emotional support.',
      'Corporate sponsors pay the overhead, so all of the money raised goes to the patients. You can help by donating, becoming an “Angel”, volunteering or hosting an event.',
    ].join('\n\n'),
    website: 'https://www.breastcancerangels.org',
    tournaments: ['victory-dink-for-pink-2026'],
  },
]
