'use client'

import { Check, ListEditor, newId, SaveBar, SectionForm, TextField, useSection } from '@/components/admin/kit'
import type { FaqT } from '@/lib/content-schema'

export function FaqEditor({ initial }: { initial: FaqT[] }) {
  const s = useSection('faqs', initial)
  return (
    <SectionForm errors={s.errors}>
      <ListEditor<FaqT>
        path=""
        items={s.value}
        onChange={s.setValue}
        title={(f) => f.q}
        badge={(f) => (!f.visible ? <span className="adm-badge off">Hidden</span> : null)}
        addLabel="Add question"
        makeNew={() => ({ id: newId(), q: 'New question?', a: 'Answer in a sentence or two.', visible: false })}
        render={(f, i, set) => (
          <>
            <TextField label="Question" path={`${i}.q`} value={f.q} max={140} onChange={(v) => set({ ...f, q: v })} />
            <TextField label="Answer" path={`${i}.a`} value={f.a} max={600} multiline={3} onChange={(v) => set({ ...f, a: v })} />
            <Check label="Show on the site" path={`${i}.visible`} checked={f.visible} onChange={(v) => set({ ...f, visible: v })} />
          </>
        )}
      />
      <SaveBar s={s} />
    </SectionForm>
  )
}
