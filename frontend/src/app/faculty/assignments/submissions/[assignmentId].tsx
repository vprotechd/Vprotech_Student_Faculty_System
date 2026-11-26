import React, { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { gradeAssignmentSubmission, listAssignmentSubmissions } from '../../../../api/assignmentApi';
import { Button, Card, COLORS, Empty, ErrorBanner, Header, Loading, Pill, Screen, formatDate } from '../../../../components/portal';

export default function AssignmentSubmissions() {
 const {assignmentId}=useLocalSearchParams<{assignmentId:string}>(); const [rows,setRows]=useState<any[]>([]); const [title,setTitle]=useState(''); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [grades,setGrades]=useState<Record<string,{marks:string;feedback:string}>>({}); const [saving,setSaving]=useState('');
 const load=useCallback(async()=>{try{const d=await listAssignmentSubmissions(String(assignmentId));setTitle(d.assignment.title);setRows(d.submissions);}catch(e:any){setError(e?.response?.data?.message||'Unable to load submissions.');}finally{setLoading(false);}},[assignmentId]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 const grade=async(row:any)=>{const v=grades[row._id]||{marks:String(row.marks??''),feedback:row.feedback||''};if(v.marks.trim()===''){Alert.alert('Marks required');return;}try{setSaving(row._id);await gradeAssignmentSubmission(String(assignmentId),row._id,Number(v.marks),v.feedback);await load();Alert.alert('Saved','Feedback and marks saved.');}catch(e:any){Alert.alert('Unable to grade',e?.response?.data?.message||'Please try again.');}finally{setSaving('');}};
 if(loading)return <Screen><Header title="Submissions"/><Loading/></Screen>;
 return <Screen><Header title="Student submissions" subtitle={title}/><ScrollView contentContainerStyle={s.content}><ErrorBanner message={error}/>
 {rows.length===0?<Card><Empty icon="file-tray-outline" title="No submissions yet" text="Student submissions will appear here." /></Card>:rows.map(row=>{const student=row.student?.userId||{};const value=grades[row._id]||{marks:String(row.marks??''),feedback:row.feedback||''};return <Card key={row._id} style={s.card}><View style={s.row}><Text style={s.name}>{student.name||row.student?.studentId||'Student'}</Text><Pill text={row.status}/></View><Text style={s.meta}>{student.email||''} · Submitted {formatDate(row.submittedAt)}</Text><Button label={`Download ${row.file?.fileName||'submission'}`} icon="download-outline" variant="ghost" onPress={()=>void Linking.openURL(row.file.url)}/>
 <Text style={s.label}>Marks (max {row.assignment?.maxMarks||'as set'})</Text><TextInput value={value.marks} onChangeText={t=>setGrades(p=>({...p,[row._id]:{...value,marks:t}}))} keyboardType="decimal-pad" style={s.input} placeholder="Enter marks"/>
 <Text style={s.label}>Feedback</Text><TextInput value={value.feedback} onChangeText={t=>setGrades(p=>({...p,[row._id]:{...value,feedback:t}}))} style={[s.input,{minHeight:75,textAlignVertical:'top'}]} multiline placeholder="Write feedback for the student"/>
 <Button label={saving===row._id?'Saving...':'Save evaluation'} loading={saving===row._id} onPress={()=>void grade(row)}/>
 </Card>;})}</ScrollView></Screen>;
}
const s=StyleSheet.create({content:{padding:16,gap:12},card:{gap:10},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},name:{fontSize:16,fontWeight:'800',color:COLORS.text,flex:1},meta:{fontSize:12,color:COLORS.sub},label:{fontWeight:'700',color:COLORS.text,fontSize:13},input:{borderWidth:1,borderColor:COLORS.border,borderRadius:10,padding:11,color:COLORS.text,backgroundColor:'#fff'}});
