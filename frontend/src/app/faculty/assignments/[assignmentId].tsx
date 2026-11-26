import React, { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { deleteAssignment, getAssignment, publishAssignment, Assignment } from '../../../api/assignmentApi';
import { Button, Card, COLORS, ErrorBanner, Header, Loading, Pill, Screen, formatDate } from '../../../components/portal';

export default function FacultyAssignmentDetail() {
 const {assignmentId}=useLocalSearchParams<{assignmentId:string}>(); const [item,setItem]=useState<Assignment|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 const load=useCallback(async()=>{try{const d=await getAssignment(String(assignmentId));setItem(d.assignment);}catch(e:any){setError(e?.response?.data?.message||'Unable to load assignment.');}finally{setLoading(false);}},[assignmentId]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 const remove=()=>Alert.alert('Delete assignment','Delete this assignment permanently?', [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{try{await deleteAssignment(String(assignmentId));router.replace('/faculty/assignments' as any);}catch(e:any){Alert.alert('Unable to delete',e?.response?.data?.message||'Please try again.');}}}]);
 const publish=async()=>{try{await publishAssignment(String(assignmentId));await load();Alert.alert('Published','Students can now view this assignment.');}catch(e:any){Alert.alert('Unable to publish',e?.response?.data?.message||'Please try again.');}};
 if(loading)return <Screen><Header title="Assignment"/><Loading/></Screen>;
 return <Screen><Header title="Assignment details"/><ScrollView contentContainerStyle={s.content}><ErrorBanner message={error}/>
 {item&&<Card style={s.card}><View style={s.row}><Text style={s.title}>{item.title}</Text><Pill text={item.status}/></View><Text style={s.body}>{item.description}</Text>{item.instructions?<Text style={s.body}>Instructions: {item.instructions}</Text>:null}
 <Text style={s.meta}>Deadline: {formatDate(item.dueDate)} · {new Date(item.dueDate).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</Text><Text style={s.meta}>Maximum marks: {item.maxMarks}</Text>
 {item.attachment?.url?<Button label={`Open attachment · ${item.attachment.fileName}`} icon="download-outline" variant="ghost" onPress={()=>void Linking.openURL(item.attachment!.url)}/>:null}
 <Button label="View student submissions" icon="people-outline" onPress={()=>router.push({pathname:'/faculty/assignments/submissions/[assignmentId]',params:{assignmentId:String(assignmentId)}} as any)}/>
 {item.status!=='published'?<Button label="Publish assignment" icon="cloud-upload-outline" onPress={()=>void publish()}/>:null}
 <Button label="Edit assignment" icon="create-outline" variant="ghost" disabled={item.status==='closed'} onPress={()=>router.push({pathname:'/faculty/assignments/create',params:{id:item._id}} as any)}/>
 <Button label="Delete assignment" icon="trash-outline" variant="danger" onPress={remove}/>
 </Card>}</ScrollView></Screen>;
}
const s=StyleSheet.create({content:{padding:16},card:{gap:13},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},title:{fontSize:19,fontWeight:'800',color:COLORS.text,flex:1},body:{fontSize:14,color:COLORS.text,lineHeight:21},meta:{color:COLORS.sub,fontSize:13}});
