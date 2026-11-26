import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { saveAssignment, getAssignment } from '../../../api/assignmentApi';
import { Button, Card, COLORS, ErrorBanner, Header, Loading, Screen } from '../../../components/portal';

export default function AssignmentEditor() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [title,setTitle]=useState(''); const [description,setDescription]=useState(''); const [instructions,setInstructions]=useState('');
  const [dueDate,setDueDate]=useState(''); const [maxMarks,setMaxMarks]=useState('100'); const [course,setCourse]=useState('');
  const [semester,setSemester]=useState(''); const [section,setSection]=useState(''); const [file,setFile]=useState<any>(null);
  const [saving,setSaving]=useState(false); const [loading,setLoading]=useState(Boolean(id)); const [error,setError]=useState('');
  useEffect(()=>{ if(!id)return; getAssignment(id).then(({assignment:a})=>{setTitle(a.title);setDescription(a.description);setInstructions(a.instructions||'');setDueDate(new Date(a.dueDate).toISOString().slice(0,16));setMaxMarks(String(a.maxMarks));setCourse(typeof a.course==='string'?a.course:(a.course?._id||''));setSemester(a.semester?String(a.semester):'');setSection(a.section||'');}).catch(e=>setError(e?.response?.data?.message||'Unable to load assignment.')).finally(()=>setLoading(false)); },[id]);
  const pickFile=async()=>{const result=await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true,multiple:false});if(!result.canceled)setFile(result.assets[0]);};
  const save=async()=>{if(!title.trim()||!description.trim()||!dueDate||!maxMarks){setError('Title, description, deadline and marks are required.');return;}const parsed=new Date(dueDate);if(Number.isNaN(parsed.getTime())){setError('Enter a valid deadline, e.g. 2026-12-15T23:59');return;}try{setSaving(true);setError('');await saveAssignment({title,description,instructions,dueDate:parsed.toISOString(),maxMarks,course,semester,section},file,id||undefined);Alert.alert('Success',id?'Assignment updated.':'Assignment created.');router.replace('/faculty/assignments' as any);}catch(e:any){setError(e?.response?.data?.message||'Unable to save assignment.');}finally{setSaving(false);}};
  if(loading)return <Screen><Header title="Edit assignment"/><Loading/></Screen>;
  return <Screen><Header title={id?'Edit assignment':'Create assignment'} subtitle="Assignment details and deadline"/><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <ErrorBanner message={error}/>
    <Card style={s.card}>
      <Text style={s.label}>Assignment title *</Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. React Native practical" style={s.input}/>
      <Text style={s.label}>Description *</Text><TextInput value={description} onChangeText={setDescription} placeholder="Describe the assignment" multiline style={[s.input,s.multiline]}/>
      <Text style={s.label}>Instructions</Text><TextInput value={instructions} onChangeText={setInstructions} placeholder="Submission instructions (optional)" multiline style={[s.input,s.multiline]}/>
      <Text style={s.label}>Deadline *</Text><TextInput value={dueDate} onChangeText={setDueDate} placeholder="2026-12-15T23:59" style={s.input} autoCapitalize="none"/><Text style={s.hint}>Use local date/time format: YYYY-MM-DDTHH:mm</Text>
      <Text style={s.label}>Maximum marks *</Text><TextInput value={maxMarks} onChangeText={setMaxMarks} keyboardType="numeric" style={s.input}/>
      <Text style={s.label}>Course ID (optional)</Text><TextInput value={course} onChangeText={setCourse} placeholder="MongoDB Course ObjectId" style={s.input} autoCapitalize="none"/>
      <View style={s.row}><View style={{flex:1}}><Text style={s.label}>Semester</Text><TextInput value={semester} onChangeText={setSemester} placeholder="e.g. 3" keyboardType="numeric" style={s.input}/></View><View style={{flex:1}}><Text style={s.label}>Section</Text><TextInput value={section} onChangeText={setSection} placeholder="e.g. A" style={s.input}/></View></View>
      <Pressable onPress={pickFile} style={s.file}><Text style={s.fileText}>{file?.name || 'Attach assignment instructions (PDF, DOCX, PPTX, ZIP or image)'}</Text><Text style={s.link}>Choose file</Text></Pressable>
      <Button label={saving?'Saving...':id?'Save changes':'Create assignment'} loading={saving} onPress={()=>void save()}/>
    </Card>
  </ScrollView></Screen>;
}
const s=StyleSheet.create({content:{padding:16},card:{gap:10},label:{fontSize:13,fontWeight:'700',color:COLORS.text,marginTop:4},input:{borderWidth:1,borderColor:COLORS.border,borderRadius:10,padding:12,color:COLORS.text,backgroundColor:'#fff'},multiline:{minHeight:90,textAlignVertical:'top'},hint:{fontSize:11,color:COLORS.sub},row:{flexDirection:'row',gap:12},file:{padding:14,borderWidth:1,borderStyle:'dashed',borderColor:COLORS.primary,borderRadius:10,gap:8},fileText:{color:COLORS.sub},link:{color:COLORS.primary,fontWeight:'700'}});
