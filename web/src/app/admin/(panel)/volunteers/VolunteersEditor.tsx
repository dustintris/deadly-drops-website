'use client'

import { Check, ImageField, LinesField, ListEditor, newId, SaveBar, SectionForm, TextField, useSection } from '@/components/admin/kit'
import type { VolunteerPersonT, VolunteerRoleT, VolunteersT } from '@/lib/content-schema'

/** the schema's caps (content-schema.ts → Volunteers) */
const MAX_PEOPLE = 80
const MAX_ROLES = 12
const MAX_PERKS = 6

export function VolunteersEditor({ initial, rev }: { initial: VolunteersT; rev: number }) {
  const s = useSection('volunteers', initial, rev)
  const v = s.value
  const set = (patch: Partial<VolunteersT>) => s.setValue((prev) => ({ ...prev, ...patch }))
  const shown = v.roles.filter((r) => r.visible).length
  const full = v.roles.length >= MAX_ROLES
  const peopleShown = v.people.filter((p) => p.visible).length
  const crewFull = v.people.length >= MAX_PEOPLE

  return (
    <SectionForm errors={s.errors}>
      <section className="adm-card" aria-labelledby="vol-people-h">
        <h2 id="vol-people-h">Our volunteers</h2>
        <p className="adm-muted" role="status">
          {v.people.length
            ? `${v.people.length} ${v.people.length === 1 ? 'volunteer' : 'volunteers'}, ${peopleShown} shown in “Meet our volunteers” at the top of the page, in this order.`
            : 'No volunteers yet: the page skips “Meet our volunteers” until you add one. Add each person with their OK to be on the website.'}
        </p>
        <ListEditor<VolunteerPersonT>
          path="people"
          items={v.people}
          onChange={(people) => set({ people })}
          title={(p) => p.name}
          thumb={(p) => p.photo?.src}
          badge={(p) => (
            <>
              {p.role && <span className="adm-badge">{p.role}</span>}
              {!p.visible && <span className="adm-badge off">Hidden</span>}
              {!p.photo && <span className="adm-badge off">No photo yet</span>}
            </>
          )}
          addLabel="Add volunteer"
          // new people start hidden, so nobody goes live before their details are right
          makeNew={crewFull ? undefined : () => ({ id: newId(), name: 'New volunteer', role: '', bio: '', visible: false })}
          render={(p, i, setPerson) => (
            <>
              <div className="adm-grid">
                <TextField label="Name" path={`people.${i}.name`} value={p.name} max={80}
                  hint="As they'd like it shown, e.g. Maria G." onChange={(x) => setPerson({ ...p, name: x })} />
                <TextField label="Role (optional)" path={`people.${i}.role`} value={p.role} max={60}
                  hint="What they usually do, e.g. Check-in desk." onChange={(x) => setPerson({ ...p, role: x })} />
              </div>
              <TextField label="About them (optional)" path={`people.${i}.bio`} value={p.bio} max={240} multiline={3}
                hint="A line about them, or in their own words (up to 240 characters)." onChange={(x) => setPerson({ ...p, bio: x })} />
              <ImageField label="Photo (optional)" path={`people.${i}.photo`} value={p.photo}
                hint="A friendly photo of their face works best; it's cropped to a portrait. Only post a photo they've agreed to. Without one, their initials are shown."
                onChange={(x) => setPerson({ ...p, photo: x })} />
              <Check label="Show on the site" path={`people.${i}.visible`} checked={p.visible}
                hint="Untick to take them off the page without deleting them." onChange={(x) => setPerson({ ...p, visible: x })} />
            </>
          )}
        />
        {crewFull && <p className="adm-muted">That&rsquo;s the most the page holds ({MAX_PEOPLE}). Remove one to add another.</p>}
      </section>

      <section className="adm-card" aria-labelledby="vol-roles-h">
        <h2 id="vol-roles-h">Roles</h2>
        <p className="adm-muted" role="status">
          {v.roles.length
            ? `${v.roles.length} ${v.roles.length === 1 ? 'role' : 'roles'}, ${shown} shown on the site as numbered cards in this order.`
            : 'No roles yet: the page skips the roles section. Add the first one below.'}
        </p>
        <ListEditor<VolunteerRoleT>
          path="roles"
          items={v.roles}
          onChange={(roles) => set({ roles })}
          title={(r) => r.title}
          badge={(r) => (!r.visible ? <span className="adm-badge off">Hidden</span> : null)}
          addLabel="Add role"
          // new roles start hidden, so a half-written one never goes live by accident
          makeNew={full ? undefined : () => ({ id: newId(), title: 'New role', body: 'What this volunteer does on the day.', visible: false })}
          render={(r, i, setRole) => (
            <>
              <TextField label="Role name" path={`roles.${i}.title`} value={r.title} max={60}
                hint="Short, e.g. Check-in desk." onChange={(x) => setRole({ ...r, title: x })} />
              <TextField label="What the role involves" path={`roles.${i}.body`} value={r.body} max={300} multiline={3}
                hint="One or two sentences (5 to 300 characters)." onChange={(x) => setRole({ ...r, body: x })} />
              <Check label="Show on the site" path={`roles.${i}.visible`} checked={r.visible} onChange={(x) => setRole({ ...r, visible: x })} />
            </>
          )}
        />
        {full && <p className="adm-muted">That&rsquo;s the most the page holds ({MAX_ROLES}). Remove one to add another.</p>}
      </section>

      <section className="adm-card" aria-labelledby="vol-perks-h">
        <h2 id="vol-perks-h">What volunteers get</h2>
        <LinesField label="Perks" path="perks" value={v.perks} max={MAX_PERKS} onChange={(perks) => set({ perks })}
          hint={`Up to ${MAX_PERKS}, one per line, e.g. Volunteer shirt. Shown as a “What you get” list; leave it empty to hide the list.`} />
      </section>

      <section className="adm-card" aria-labelledby="vol-signup-h">
        <h2 id="vol-signup-h">Sign-up form</h2>
        <Check label="Take sign-ups on the page" path="signupOpen" checked={v.signupOpen} onChange={(x) => set({ signupOpen: x })}
          hint="Ticked: the page has a sign-up form, and each sign-up arrives in the Inbox under “Volunteering”. Unticked: the form is hidden and the page shows your note with a link to the Contact page." />
        <TextField label="Sign-up note (optional)" path="signupNote" value={v.signupNote} max={240} multiline={2}
          hint={v.signupOpen
            ? 'Shown above the form, e.g. what to put in the message.'
            : 'Shown instead of the form while sign-ups are closed, e.g. when they open again. Left empty, the page says sign-ups are closed for now.'}
          onChange={(x) => set({ signupNote: x })} />
      </section>

      <SaveBar s={s} />
    </SectionForm>
  )
}
