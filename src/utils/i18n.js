export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pt', label: 'Português' },
  { code: 'pl', label: 'Polski' },
  { code: 'sv', label: 'Svenska' },
  { code: 'da', label: 'Dansk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'no', label: 'Norsk' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
]

const DICT = {
  en: {
    topics: 'Topics', status: 'Status', topic: 'Topic', description: 'Description',
    new: 'New', open: 'Open', inProgress: 'In Progress', complete: 'Complete',
    participants: 'Participants', date: 'Date', meetingNotes: 'Meeting Notes',
    notes: 'Notes', team: 'Team', chart: 'Chart', label: 'Label', value: 'Value',
    miscMeetings: 'Misc Meetings', masterNotes: 'Master Notes',
  },
  de: {
    topics: 'Themen', status: 'Status', topic: 'Thema', description: 'Beschreibung',
    new: 'Neu', open: 'Offen', inProgress: 'In Bearbeitung', complete: 'Erledigt',
    participants: 'Teilnehmer', date: 'Datum', meetingNotes: 'Besprechungsnotizen',
    notes: 'Notizen', team: 'Team', chart: 'Diagramm', label: 'Bezeichnung', value: 'Wert',
    miscMeetings: 'Verschiedene Meetings', masterNotes: 'Stammnotizen',
  },
  fr: {
    topics: 'Sujets', status: 'Statut', topic: 'Sujet', description: 'Description',
    new: 'Nouveau', open: 'Ouvert', inProgress: 'En cours', complete: 'Terminé',
    participants: 'Participants', date: 'Date', meetingNotes: 'Notes de réunion',
    notes: 'Notes', team: 'Équipe', chart: 'Graphique', label: 'Libellé', value: 'Valeur',
    miscMeetings: 'Réunions diverses', masterNotes: 'Notes permanentes',
  },
  es: {
    topics: 'Temas', status: 'Estado', topic: 'Tema', description: 'Descripción',
    new: 'Nuevo', open: 'Abierto', inProgress: 'En curso', complete: 'Completado',
    participants: 'Participantes', date: 'Fecha', meetingNotes: 'Notas de reunión',
    notes: 'Notas', team: 'Equipo', chart: 'Gráfico', label: 'Etiqueta', value: 'Valor',
    miscMeetings: 'Reuniones varias', masterNotes: 'Notas maestras',
  },
  it: {
    topics: 'Argomenti', status: 'Stato', topic: 'Argomento', description: 'Descrizione',
    new: 'Nuovo', open: 'Aperto', inProgress: 'In corso', complete: 'Completato',
    participants: 'Partecipanti', date: 'Data', meetingNotes: 'Note della riunione',
    notes: 'Note', team: 'Team', chart: 'Grafico', label: 'Etichetta', value: 'Valore',
    miscMeetings: 'Riunioni varie', masterNotes: 'Note principali',
  },
  nl: {
    topics: 'Onderwerpen', status: 'Status', topic: 'Onderwerp', description: 'Beschrijving',
    new: 'Nieuw', open: 'Open', inProgress: 'In uitvoering', complete: 'Voltooid',
    participants: 'Deelnemers', date: 'Datum', meetingNotes: 'Vergadernotities',
    notes: 'Notities', team: 'Team', chart: 'Grafiek', label: 'Label', value: 'Waarde',
    miscMeetings: 'Overige vergaderingen', masterNotes: 'Stamnotities',
  },
  pt: {
    topics: 'Tópicos', status: 'Estado', topic: 'Tópico', description: 'Descrição',
    new: 'Novo', open: 'Aberto', inProgress: 'Em andamento', complete: 'Concluído',
    participants: 'Participantes', date: 'Data', meetingNotes: 'Notas da reunião',
    notes: 'Notas', team: 'Equipa', chart: 'Gráfico', label: 'Rótulo', value: 'Valor',
    miscMeetings: 'Reuniões diversas', masterNotes: 'Notas principais',
  },
  pl: {
    topics: 'Tematy', status: 'Status', topic: 'Temat', description: 'Opis',
    new: 'Nowy', open: 'Otwarty', inProgress: 'W toku', complete: 'Ukończony',
    participants: 'Uczestnicy', date: 'Data', meetingNotes: 'Notatki ze spotkania',
    notes: 'Notatki', team: 'Zespół', chart: 'Wykres', label: 'Etykieta', value: 'Wartość',
    miscMeetings: 'Różne spotkania', masterNotes: 'Notatki główne',
  },
  sv: {
    topics: 'Ämnen', status: 'Status', topic: 'Ämne', description: 'Beskrivning',
    new: 'Ny', open: 'Öppen', inProgress: 'Pågående', complete: 'Avslutad',
    participants: 'Deltagare', date: 'Datum', meetingNotes: 'Mötesanteckningar',
    notes: 'Anteckningar', team: 'Team', chart: 'Diagram', label: 'Etikett', value: 'Värde',
    miscMeetings: 'Diverse möten', masterNotes: 'Huvudanteckningar',
  },
  da: {
    topics: 'Emner', status: 'Status', topic: 'Emne', description: 'Beskrivelse',
    new: 'Ny', open: 'Åben', inProgress: 'I gang', complete: 'Afsluttet',
    participants: 'Deltagere', date: 'Dato', meetingNotes: 'Mødenoter',
    notes: 'Notater', team: 'Team', chart: 'Diagram', label: 'Etiket', value: 'Værdi',
    miscMeetings: 'Diverse møder', masterNotes: 'Stamnoter',
  },
  fi: {
    topics: 'Aiheet', status: 'Tila', topic: 'Aihe', description: 'Kuvaus',
    new: 'Uusi', open: 'Avoin', inProgress: 'Käynnissä', complete: 'Valmis',
    participants: 'Osallistujat', date: 'Päivämäärä', meetingNotes: 'Kokousmuistio',
    notes: 'Muistiinpanot', team: 'Tiimi', chart: 'Kaavio', label: 'Otsikko', value: 'Arvo',
    miscMeetings: 'Muut kokoukset', masterNotes: 'Päämuistiinpanot',
  },
  no: {
    topics: 'Emner', status: 'Status', topic: 'Emne', description: 'Beskrivelse',
    new: 'Ny', open: 'Åpen', inProgress: 'Pågående', complete: 'Fullført',
    participants: 'Deltakere', date: 'Dato', meetingNotes: 'Møtenotater',
    notes: 'Notater', team: 'Team', chart: 'Diagram', label: 'Etikett', value: 'Verdi',
    miscMeetings: 'Diverse møter', masterNotes: 'Stamnotater',
  },
  ja: {
    topics: 'トピック', status: 'ステータス', topic: 'トピック', description: '説明',
    new: '新規', open: 'オープン', inProgress: '進行中', complete: '完了',
    participants: '参加者', date: '日付', meetingNotes: '議事録',
    notes: 'ノート', team: 'チーム', chart: 'グラフ', label: 'ラベル', value: '値',
    miscMeetings: 'その他の会議', masterNotes: 'マスターノート',
  },
  zh: {
    topics: '主题', status: '状态', topic: '主题', description: '描述',
    new: '新建', open: '进行中', inProgress: '处理中', complete: '已完成',
    participants: '参与者', date: '日期', meetingNotes: '会议记录',
    notes: '笔记', team: '团队', chart: '图表', label: '标签', value: '值',
    miscMeetings: '其他会议', masterNotes: '主要备注',
  },
}

export function getSystemLanguage() {
  const lang = (navigator.language || 'en').slice(0, 2)
  return DICT[lang] ? lang : 'en'
}

export function makeT(langCode) {
  const code = langCode && DICT[langCode] ? langCode : getSystemLanguage()
  const dict = DICT[code] || DICT['en']
  return (key) => dict[key] ?? DICT['en'][key] ?? key
}
