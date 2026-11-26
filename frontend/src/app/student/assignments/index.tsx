import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Assignment, listAssignments } from '../../../api/assignmentApi';
import { Card, COLORS, Empty, ErrorBanner, Header, Loading, Pill, Screen, formatDate } from '../../../components/portal';

export default function StudentAssignments() {
 const [items,setItems]=useState<Assignment[]>([]);const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async()=>{try{setError('');setItems(await listAssignments());}catch(e:any){setError(e?.response?.data?.message||'Unable to load assignments.');}finally{setLoading(false);setRefreshing(false);}},[]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 if(loading)return <Screen><Header title="Assignments"/><Loading/></Screen>;
 return <Screen><Header title="Assignments" subtitle="Your assigned coursework"/><ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}><ErrorBanner message={error}/>
 {items.length===0?<Card><Empty icon="document-text-outline" title="No assignments available" text="Published assignments for your course will appear here."/></Card>:items.map(a=><Pressable key={a._id} onPress={()=>router.push({pathname:'/student/assignments/[assignmentId]',params:{assignmentId:a._id}} as any)}><Card style={s.card}><View style={s.row}><Text style={s.title}>{a.title}</Text><Pill text={a.mySubmission?.status||'Not submitted'} color={a.mySubmission?.status==='graded'?COLORS.success:COLORS.warning}/></View><Text style={s.desc} numberOfLines={2}>{a.description}</Text><View style={s.row}><Text style={s.meta}>Due {formatDate(a.dueDate)}</Text><Text style={s.meta}>{a.maxMarks} marks</Text></View>{a.mySubmission?.status==='graded'?<Text style={s.result}>Marks: {a.mySubmission.marks} / {a.maxMarks}</Text>:null}<Text style={s.link}>View assignment  ›</Text></Card></Pressable>)}</ScrollView></Screen>;
}
const s=StyleSheet.create({content:{padding:16,gap:12},card:{gap:10},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},title:{flex:1,fontSize:16,fontWeight:'800',color:COLORS.text},desc:{color:COLORS.sub,lineHeight:20},meta:{fontSize:12,color:COLORS.sub},result:{color:COLORS.success,fontWeight:'800'},link:{color:COLORS.primary,fontWeight:'700'}});
