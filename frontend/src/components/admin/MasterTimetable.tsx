import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import API from '../../api/apiClient';

type Entity = {
  _id: string;
  name: string;
  code?: string;
  departmentId?: string | Entity | null;
  courseId?: string | Entity | null;
  semester?: number;
  facultyIds?: Array<string | Entity>;
  isActive?: boolean;
  userId?: { name?: string; email?: string; isActive?: boolean } | null;
};

type TimetableRecord = {
  _id: string;
  title: string;
  departmentId: string;
  courseId: string;
  subjectId: string;
  facultyId: string;
  semester: number;
  section: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
  isActive?: boolean;
};

type PickerKind = 'department' | 'course' | 'subject' | 'faculty' | 'day';
type PickerOption = { id: string; label: string };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const asArray = <T,>(response: unknown): T[] => {
  if (!response || typeof response !== 'object') {
    throw new Error('The server returned an invalid list response.');
  }
  const data = (response as { data?: { data?: unknown } }).data?.data;
  if (!Array.isArray(data)) {
    throw new Error('The server returned an invalid list response.');
  }
  return data as T[];
};

const idOf = (value: string | Entity | null | undefined) =>
  typeof value === 'string' ? value : value?._id || '';

export default function MasterTimetable() {
  const [departments, setDepartments] = useState<Entity[]>([]);
  const [courses, setCourses] = useState<Entity[]>([]);
  const [subjects, setSubjects] = useState<Entity[]>([]);
  const [faculty, setFaculty] = useState<Entity[]>([]);
  const [records, setRecords] = useState<TimetableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');

  // Inline "add new department / course / subject" (these lists are empty on a
  // fresh install, which made it impossible to save any timetable entry).
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newNumber, setNewNumber] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [departmentResponse, courseResponse, subjectResponse, employeeResponse, timetableResponse] =
        await Promise.all([
          API.get('/departments', { params: { limit: 100 } }),
          API.get('/courses', { params: { limit: 100 } }),
          API.get('/subjects', { params: { limit: 100 } }),
          API.get('/admin/employees'),
          API.get('/timetable', { params: { limit: 100 } }),
        ]);

      setDepartments(asArray<Entity>(departmentResponse).filter((item) => item.isActive !== false));
      setCourses(asArray<Entity>(courseResponse).filter((item) => item.isActive !== false));
      setSubjects(asArray<Entity>(subjectResponse).filter((item) => item.isActive !== false));
      setFaculty(
        asArray<Entity>(employeeResponse).filter(
          (item) => item.userId?.isActive !== false && !!item.userId
        )
      );
      setRecords(
        asArray<TimetableRecord>(timetableResponse)
          .filter((item) => item.isActive !== false)
          .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime))
      );
    } catch (error: any) {
      Alert.alert(
        'Could not load master timetable',
        error?.response?.data?.message || error?.message || 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const departmentOptions = useMemo(
    () => departments.map((item) => ({ id: item._id, label: `${item.name}${item.code ? ` (${item.code})` : ''}` })),
    [departments]
  );
  const courseOptions = useMemo(
    () => courses.filter((item) => !departmentId || idOf(item.departmentId) === departmentId)
      .map((item) => ({ id: item._id, label: `${item.name}${item.code ? ` (${item.code})` : ''}` })),
    [courses, departmentId]
  );
  const subjectOptions = useMemo(
    () => subjects.filter((item) =>
      (!courseId || idOf(item.courseId) === courseId) &&
      (!departmentId || idOf(item.departmentId) === departmentId)
    ).map((item) => ({ id: item._id, label: `${item.name}${item.code ? ` (${item.code})` : ''} · Sem ${item.semester}` })),
    [subjects, courseId, departmentId]
  );
  const facultyOptions = useMemo(() => {
    const subject = subjects.find((item) => item._id === subjectId);
    const assignedFacultyIds = subject?.facultyIds?.map((item) => idOf(item)) || [];
    return faculty.filter((item) =>
      item._id === facultyId || !assignedFacultyIds.length || assignedFacultyIds.includes(item._id)
    )
      .map((item) => ({
        id: item._id,
        label: `${item.userId?.name || 'Faculty'}${item.userId?.email ? ` (${item.userId.email})` : ''}`,
      }));
  }, [faculty, subjects, subjectId, facultyId]);

  const nameFor = (items: Entity[], id: string) => items.find((item) => item._id === id)?.name || '—';
  const facultyNameFor = (id: string) => {
    const item = faculty.find((entry) => entry._id === id);
    return item?.userId?.name || item?.userId?.email || '—';
  };

  const clearForm = () => {
    setEditingId(null);
    setTitle('');
    setDepartmentId('');
    setCourseId('');
    setSubjectId('');
    setFacultyId('');
    setSemester('');
    setSection('');
    setDayOfWeek('Monday');
    setStartTime('');
    setEndTime('');
    setRoom('');
  };

  const choose = (kind: PickerKind, value: string) => {
    if (kind === 'department') {
      setDepartmentId(value);
      setCourseId('');
      setSubjectId('');
      setFacultyId('');
      setSemester('');
    } else if (kind === 'course') {
      setCourseId(value);
      setSubjectId('');
      setFacultyId('');
      setSemester('');
    } else if (kind === 'subject') {
      setSubjectId(value);
      setFacultyId('');
      const selectedSubject = subjects.find((item) => item._id === value);
      if (selectedSubject?.semester) setSemester(String(selectedSubject.semester));
    } else if (kind === 'faculty') {
      setFacultyId(value);
    } else {
      setDayOfWeek(value);
    }
    setPicker(null);
    setAdding(false);
  };

  const edit = (record: TimetableRecord) => {
    setEditingId(record._id);
    setTitle(record.title || '');
    setDepartmentId(idOf(record.departmentId));
    setCourseId(idOf(record.courseId));
    setSubjectId(idOf(record.subjectId));
    setFacultyId(idOf(record.facultyId));
    setSemester(String(record.semester || ''));
    setSection(record.section || '');
    setDayOfWeek(record.dayOfWeek || 'Monday');
    setStartTime(record.startTime || '');
    setEndTime(record.endTime || '');
    setRoom(record.room || '');
  };

  const save = async () => {
    const wasEditing = Boolean(editingId);
    const cleanTitle = title.trim();
    const cleanSection = section.trim().toUpperCase();
    const cleanSemester = Number(semester);
    if (!cleanTitle || !departmentId || !courseId || !subjectId || !facultyId || !cleanSection || !semester || !startTime || !endTime) {
      Alert.alert('Missing fields', 'Complete the title, department, course, subject, faculty, semester, section and class times.');
      return;
    }
    if (!Number.isInteger(cleanSemester) || cleanSemester < 1 || cleanSemester > 20) {
      Alert.alert('Invalid semester', 'Enter a semester between 1 and 20.');
      return;
    }
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime) || startTime >= endTime) {
      Alert.alert('Invalid class time', 'Use 24-hour HH:MM times and make sure the end time is later than the start time.');
      return;
    }

    const payload = {
      title: cleanTitle,
      departmentId,
      courseId,
      subjectId,
      facultyId,
      semester: cleanSemester,
      section: cleanSection,
      dayOfWeek,
      startTime,
      endTime,
      room: room.trim(),
    };

    try {
      setSaving(true);
      const response = editingId
        ? await API.patch(`/timetable/${editingId}`, payload)
        : await API.post('/timetable', payload);
      const saved = response.data?.data as TimetableRecord | undefined;
      if (!saved?._id) {
        throw new Error(response.data?.message || 'The server did not confirm the saved timetable entry.');
      }
      clearForm();
      await load();
      Alert.alert('Timetable saved', wasEditing ? 'The class schedule was updated.' : 'The class schedule was added.');
    } catch (error: any) {
      Alert.alert(
        editingId ? 'Could not update timetable' : 'Could not save timetable',
        error?.response?.data?.message || error?.message || 'Something went wrong.'
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = (record: TimetableRecord) => {
    Alert.alert('Delete timetable entry', `Delete "${record.title}" from the master timetable?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await API.delete(`/timetable/${record._id}`);
            await load();
          } catch (error: any) {
            Alert.alert('Could not delete timetable entry', error?.response?.data?.message || error?.message || 'Something went wrong.');
          }
        },
      },
    ]);
  };

  const closePicker = () => {
    setPicker(null);
    setAdding(false);
    setNewName('');
    setNewCode('');
    setNewNumber('');
  };

  const canCreate = (kind: PickerKind | null) =>
    kind === 'department' || kind === 'course' || kind === 'subject';

  const createOption = async () => {
    if (!picker || !canCreate(picker)) return;
    const kind = picker;
    const name = newName.trim();
    const code = newCode.trim().toUpperCase();
    const number = Number(newNumber);

    if (!name || !code) {
      Alert.alert('Missing fields', `Enter the ${kind} name and code.`);
      return;
    }
    if (kind === 'course' && (!Number.isInteger(number) || number < 1 || number > 10)) {
      Alert.alert('Invalid duration', 'Enter the course duration in years (1-10).');
      return;
    }
    if (kind === 'subject' && (!Number.isInteger(number) || number < 1 || number > 20)) {
      Alert.alert('Invalid semester', 'Enter a semester between 1 and 20.');
      return;
    }

    try {
      setCreating(true);
      const response =
        kind === 'department'
          ? await API.post('/departments', { name, code })
          : kind === 'course'
          ? await API.post('/courses', { name, code, departmentId, durationYears: number })
          : await API.post('/subjects', { name, code, departmentId, courseId, semester: number });
      const created = response.data?.data as Entity | undefined;
      if (!created?._id) {
        throw new Error(response.data?.message || `The ${kind} could not be saved.`);
      }
      await load();
      choose(kind, created._id);
      if (kind === 'subject') setSemester(String(number));
      closePicker();
    } catch (error: any) {
      const serverMessage: string = error?.response?.data?.message || error?.message || 'Something went wrong.';
      Alert.alert(
        `Could not add ${kind}`,
        serverMessage.includes('E11000')
          ? `A ${kind} with this name or code already exists. Pick it from the list instead.`
          : serverMessage
      );
    } finally {
      setCreating(false);
    }
  };

  const optionsFor = (kind: PickerKind): PickerOption[] => {
    if (kind === 'department') return departmentOptions;
    if (kind === 'course') return courseOptions;
    if (kind === 'subject') return subjectOptions;
    if (kind === 'faculty') return facultyOptions;
    return DAYS.map((day) => ({ id: day, label: day }));
  };
  const selectedLabel = (kind: PickerKind) => {
    const value = kind === 'department' ? departmentId
      : kind === 'course' ? courseId
      : kind === 'subject' ? subjectId
      : kind === 'faculty' ? facultyId
      : dayOfWeek;
    return optionsFor(kind).find((option) => option.id === value)?.label || `Select ${kind}`;
  };

  const field = (label: string, value: string, onChangeText: (value: string) => void, placeholder: string, keyboardType?: 'default' | 'numeric') => (
    <View style={styles.field} key={label}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        editable={!saving}
      />
    </View>
  );

  const selector = (kind: PickerKind, label: string, disabled = false) => (
    <View style={styles.field} key={kind}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, styles.selector, disabled && styles.disabled]}
        onPress={() => setPicker(kind)}
        disabled={disabled || saving}
      >
        <Text style={selectedLabel(kind).startsWith('Select ') ? styles.placeholder : styles.selectedText}>
          {selectedLabel(kind)}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );

  const activePickerOptions = picker ? optionsFor(picker) : [];
  const pickerTitle = picker ? `Select ${picker}` : '';

  return (
    <View style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editingId ? 'Edit class schedule' : 'Add class schedule'}</Text>
        {field('Class title', title, setTitle, 'e.g. Mathematics')}
        {selector('department', 'Department')}
        {selector('course', 'Course', !departmentId)}
        {selector('subject', 'Subject', !courseId)}
        {selector('faculty', 'Faculty', !subjectId)}
        <View style={styles.row}>
          <View style={styles.half}>{field('Semester', semester, setSemester, '1', 'numeric')}</View>
          <View style={styles.half}>{field('Section', section, setSection, 'A')}</View>
        </View>
        {selector('day', 'Weekday')}
        <View style={styles.row}>
          <View style={styles.half}>{field('Start time', startTime, setStartTime, '09:00')}</View>
          <View style={styles.half}>{field('End time', endTime, setEndTime, '10:00')}</View>
        </View>
        {field('Room (optional)', room, setRoom, 'Room or location')}
        <View style={styles.actions}>
          {editingId ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={clearForm} disabled={saving}>
              <Text style={styles.secondaryButtonText}>Cancel edit</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{editingId ? 'Update timetable' : 'Save timetable'}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.listTitle}>Saved class timetable</Text>
      {loading ? <ActivityIndicator size="large" color="#2563EB" style={styles.loader} /> : records.length === 0 ? (
        <Text style={styles.empty}>No class schedules have been saved yet.</Text>
      ) : records.map((record) => (
        <View key={record._id} style={styles.recordCard}>
          <View style={styles.recordInfo}>
            <Text style={styles.recordTime}>{record.dayOfWeek} · {record.startTime}–{record.endTime}</Text>
            <Text style={styles.recordTitle}>{record.title}</Text>
            <Text style={styles.recordDetail}>
              {nameFor(courses, idOf(record.courseId))} · Sem {record.semester} · Section {record.section}
            </Text>
            <Text style={styles.recordDetail}>
              {nameFor(subjects, idOf(record.subjectId))} · {facultyNameFor(idOf(record.facultyId))}
            </Text>
            {!!record.room && <Text style={styles.recordDetail}>Room: {record.room}</Text>}
          </View>
          <View style={styles.recordActions}>
            <TouchableOpacity style={styles.editButton} onPress={() => edit(record)}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => remove(record)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={closePicker}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
              {activePickerOptions.map((option) => (
                <TouchableOpacity key={option.id} style={styles.option} onPress={() => picker && choose(picker, option.id)}>
                  <Text style={styles.optionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
              {activePickerOptions.length === 0 && <Text style={styles.empty}>No options available.</Text>}
            </ScrollView>
            {canCreate(picker) && !adding ? (
              <TouchableOpacity style={styles.addNewButton} onPress={() => setAdding(true)}>
                <Text style={styles.addNewText}>+ Add new {picker}</Text>
              </TouchableOpacity>
            ) : null}
            {canCreate(picker) && adding ? (
              <View style={styles.addNewForm}>
                <TextInput style={styles.input} value={newName} onChangeText={setNewName}
                  placeholder={`${picker} name`} placeholderTextColor="#94A3B8" editable={!creating} />
                <TextInput style={styles.input} value={newCode} onChangeText={setNewCode}
                  placeholder={`${picker} code (e.g. CS101)`} placeholderTextColor="#94A3B8"
                  autoCapitalize="characters" editable={!creating} />
                {picker === 'course' || picker === 'subject' ? (
                  <TextInput style={styles.input} value={newNumber} onChangeText={setNewNumber}
                    placeholder={picker === 'course' ? 'Duration in years (e.g. 4)' : 'Semester (e.g. 1)'}
                    placeholderTextColor="#94A3B8" keyboardType="numeric" editable={!creating} />
                ) : null}
                <TouchableOpacity style={styles.saveButton} onPress={createOption} disabled={creating}>
                  {creating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save {picker}</Text>}
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={closePicker}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  formTitle: { color: '#0F172A', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { color: '#475569', fontSize: 13, fontWeight: '600' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, color: '#0F172A', backgroundColor: '#FFFFFF' },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedText: { color: '#0F172A', flex: 1 },
  placeholder: { color: '#94A3B8', flex: 1 },
  chevron: { color: '#64748B', fontSize: 22, marginLeft: 8 },
  disabled: { backgroundColor: '#F1F5F9' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  saveButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', flex: 1 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  listTitle: { color: '#0F172A', fontSize: 18, fontWeight: '700', marginTop: 4 },
  loader: { marginVertical: 24 },
  empty: { color: '#64748B', paddingVertical: 12 },
  recordCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  recordInfo: { gap: 5 },
  recordTime: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  recordTitle: { color: '#0F172A', fontWeight: '700', fontSize: 16 },
  recordDetail: { color: '#64748B', fontSize: 13 },
  recordActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editButton: { borderWidth: 1, borderColor: '#93C5FD', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  editText: { color: '#1D4ED8', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  deleteText: { color: '#DC2626', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, gap: 12 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  optionsList: { flexGrow: 0 },
  option: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  optionText: { color: '#0F172A', fontSize: 15 },
  addNewButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#93C5FD', alignItems: 'center', justifyContent: 'center' },
  addNewText: { color: '#1D4ED8', fontWeight: '700', textTransform: 'capitalize' },
  addNewForm: { gap: 10 },
});
