'use client';
// 카테고리별 신규/수정 폼. 선택된 카테고리에 따라 필드 셋이 바뀌며 OTHER 는 key-value 쌍을 다룬다.
import { FormEvent, useEffect, useState } from 'react';
import { createEntry, updateEntry, type VaultCategory, type VaultEntry } from '@/lib/vault-client';
import { CATEGORY_FIELDS, CATEGORY_LABELS } from './category-schema';

interface KeyValue {
  key: string;
  value: string;
}

interface FormState {
  label: string;
  category: VaultCategory;
  fields: Record<string, string>;
  customFields: KeyValue[];
  memo: string;
}

interface Props {
  entry: VaultEntry | null;
  onSuccess: () => void | Promise<void>;
  onCancel: () => void;
}

function emptyState(category: VaultCategory): FormState {
  return {
    label: '',
    category,
    fields: {},
    customFields: [],
    memo: ''
  };
}

function entryToForm(entry: VaultEntry): FormState {
  const payload = (entry.payload ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const spec of CATEGORY_FIELDS[entry.category]) {
    const v = payload[spec.name];
    if (typeof v === 'string') fields[spec.name] = v;
  }
  const customFields = Array.isArray(payload.customFields) ? (payload.customFields as KeyValue[]) : [];
  return {
    label: entry.label,
    category: entry.category,
    fields,
    customFields,
    memo: typeof payload.memo === 'string' ? payload.memo : ''
  };
}

export function CategoryForm({ entry, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => (entry ? entryToForm(entry) : emptyState('BANK')));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(entry ? entryToForm(entry) : emptyState('BANK'));
    setError(null);
  }, [entry]);

  function changeCategory(next: VaultCategory) {
    setForm((prev) => ({ ...emptyState(next), label: prev.label, memo: prev.memo }));
  }

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, fields: { ...prev.fields, [name]: value } }));
  }

  function addCustomField() {
    setForm((prev) => ({ ...prev, customFields: [...prev.customFields, { key: '', value: '' }] }));
  }

  function updateCustomField(index: number, patch: Partial<KeyValue>) {
    setForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((kv, i) => (i === index ? { ...kv, ...patch } : kv))
    }));
  }

  function removeCustomField(index: number) {
    setForm((prev) => ({ ...prev, customFields: prev.customFields.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!form.label.trim()) {
      setError('라벨을 입력하세요.');
      return;
    }
    if (form.category === 'OTHER') {
      const keys = form.customFields.map((kv) => kv.key.trim()).filter(Boolean);
      if (new Set(keys).size !== keys.length) {
        setError('key 가 중복되었습니다.');
        return;
      }
      if (form.customFields.length > 10) {
        setError('key-value 쌍은 최대 10개까지 허용됩니다.');
        return;
      }
    }

    const payload: Record<string, unknown> = {
      category: form.category,
      label: form.label.trim()
    };
    for (const [k, v] of Object.entries(form.fields)) {
      if (v) payload[k] = v;
    }
    if (form.category === 'OTHER') {
      payload.customFields = form.customFields
        .filter((kv) => kv.key.trim())
        .map((kv) => ({ key: kv.key.trim(), value: kv.value }));
    }
    if (form.memo.trim()) payload.memo = form.memo;

    setSubmitting(true);
    setError(null);
    try {
      if (entry) {
        await updateEntry(entry.id, payload as { category: VaultCategory; label: string });
      } else {
        await createEntry(payload as { category: VaultCategory; label: string });
      }
      await onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const fields = CATEGORY_FIELDS[form.category];

  return (
    <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0 }}>{entry ? '항목 수정' : '항목 추가'}</h3>

      <div className="form-row">
        <label htmlFor="entry-category">카테고리</label>
        <select
          id="entry-category"
          value={form.category}
          onChange={(e) => changeCategory(e.target.value as VaultCategory)}
          disabled={Boolean(entry)}
        >
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="entry-label">라벨 *</label>
        <input
          id="entry-label"
          type="text"
          value={form.label}
          onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
          maxLength={1024}
          required
        />
      </div>

      {fields.map((spec) => (
        <div className="form-row" key={spec.name}>
          <label htmlFor={`entry-${spec.name}`}>{spec.label}</label>
          <input
            id={`entry-${spec.name}`}
            type={spec.type === 'url' ? 'url' : spec.type}
            value={form.fields[spec.name] ?? ''}
            onChange={(e) => updateField(spec.name, e.target.value)}
            placeholder={spec.placeholder}
            maxLength={spec.maxLength}
            autoComplete="off"
          />
        </div>
      ))}

      {form.category === 'OTHER' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>사용자 정의 필드</strong>
            <button
              type="button"
              className="btn"
              onClick={addCustomField}
              disabled={form.customFields.length >= 10}
            >
              + 추가
            </button>
          </div>
          {form.customFields.map((kv, idx) => (
            <div className="form-row" key={idx} style={{ gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 8 }}>
              <input
                aria-label={`key ${idx + 1}`}
                value={kv.key}
                onChange={(e) => updateCustomField(idx, { key: e.target.value })}
                placeholder="key"
                maxLength={128}
              />
              <input
                aria-label={`value ${idx + 1}`}
                value={kv.value}
                onChange={(e) => updateCustomField(idx, { value: e.target.value })}
                placeholder="value"
                maxLength={4096}
              />
              <button type="button" className="btn" onClick={() => removeCustomField(idx)}>
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="form-row">
        <label htmlFor="entry-memo">메모</label>
        <textarea
          id="entry-memo"
          value={form.memo}
          onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
          rows={3}
          maxLength={4096}
        />
      </div>

      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? '저장 중...' : entry ? '저장' : '추가'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          취소
        </button>
      </div>
    </form>
  );
}
