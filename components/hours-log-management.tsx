'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  User,
  CheckCircle,
  XCircle,
  Plus,
  Download,
  Calendar,
  Users,
  TrendingUp,
  Hourglass,
  CheckSquare,
  XSquare,
} from 'lucide-react';
import { toast } from 'sonner';

export interface HoursLog {
  id: string;
  trainerId: string;
  trainerName: string;
  sessionId?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  type: 'training' | 'preparation' | 'meeting' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  trainerId: string;
  trainerName: string;
  participantId: string;
  participantName: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HoursSummary {
  trainerId: string;
  trainerName: string;
  totalHours: number;
  trainingHours: number;
  preparationHours: number;
  meetingHours: number;
  otherHours: number;
  pendingHours: number;
  approvedHours: number;
  rejectedHours: number;
}

export default function HoursLogManagement() {
  const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [hoursSummaries, setHoursSummaries] = useState<HoursSummary[]>([]);
  const [selectedTab, setSelectedTab] = useState<'hours' | 'attendance' | 'summary'>('hours');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [hoursRes, attendanceRes, summaryRes] = await Promise.all([
        fetch('/api/hours-logs'),
        fetch('/api/attendance-records'),
        fetch('/api/hours-logs?summary=true'),
      ]);

      if (hoursRes.ok) {
        const hoursData = await hoursRes.json();
        setHoursLogs(hoursData.hoursLogs || []);
      }

      if (attendanceRes.ok) {
        const attendanceData = await attendanceRes.json();
        setAttendanceRecords(attendanceData.attendanceRecords || []);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setHoursSummaries(summaryData.summaries || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveHours = async (id: string) => {
    try {
      const response = await fetch(`/api/hours-logs/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Admin' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve hours');
      }

      const data = await response.json();
      setHoursLogs(hoursLogs.map((h) => (h.id === id ? data.hoursLog : h)));
      toast.success('Stunden erfolgreich genehmigt');
    } catch (error) {
      toast.error('Fehler bei der Genehmigung');
      console.error('Approve error:', error);
    }
  };

  const handleRejectHours = async (id: string) => {
    try {
      const response = await fetch(`/api/hours-logs/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Admin' }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject hours');
      }

      const data = await response.json();
      setHoursLogs(hoursLogs.map((h) => (h.id === id ? data.hoursLog : h)));
      toast.success('Stunden abgelehnt');
    } catch (error) {
      toast.error('Fehler bei der Ablehnung');
      console.error('Reject error:', error);
    }
  };

  const getStatusColor = (status: HoursLog['status'] | AttendanceRecord['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'approved':
      case 'present':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
      case 'absent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'late':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'excused':
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusLabel = (status: HoursLog['status'] | AttendanceRecord['status']) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend';
      case 'approved':
        return 'Genehmigt';
      case 'rejected':
        return 'Abgelehnt';
      case 'present':
        return 'Anwesend';
      case 'absent':
        return 'Abwesend';
      case 'late':
        return 'Verspätet';
      case 'excused':
        return 'Entschuldigt';
    }
  };

  const getTypeColor = (type: HoursLog['type']) => {
    switch (type) {
      case 'training':
        return 'bg-purple-100 text-purple-700';
      case 'preparation':
        return 'bg-blue-100 text-blue-700';
      case 'meeting':
        return 'bg-orange-100 text-orange-700';
      case 'other':
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: HoursLog['type']) => {
    switch (type) {
      case 'training':
        return 'Training';
      case 'preparation':
        return 'Vorbereitung';
      case 'meeting':
        return 'Meeting';
      case 'other':
        return 'Sonstiges';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Stunden-Log & Anwesenheit</h1>
          <p className="text-gray-500">Verwaltung von Trainerstunden und Teilnehmeranwesenheit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neue Stunden
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
        <TabsList>
          <TabsTrigger value="hours">
            <Clock className="h-4 w-4 mr-2" />
            Stunden-Log ({hoursLogs.length})
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Users className="h-4 w-4 mr-2" />
            Anwesenheit ({attendanceRecords.length})
          </TabsTrigger>
          <TabsTrigger value="summary">
            <TrendingUp className="h-4 w-4 mr-2" />
            Zusammenfassung ({hoursSummaries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="mt-6">
          <div className="space-y-4">
            {/* Hours Logs List */}
            <div className="grid grid-cols-1 gap-4">
              {hoursLogs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <User className="h-5 w-5 text-brand-primary" />
                          </div>
                          <div>
                            <div className="font-semibold">{log.trainerName}</div>
                            <div className="text-sm text-gray-600">ID: {log.trainerId}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>
                              {format(parseISO(log.date), 'dd. MMMM yyyy', { locale: de })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>
                              {log.startTime} - {log.endTime} ({log.duration} Min)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getTypeColor(log.type)}>
                              {getTypeLabel(log.type)}
                            </Badge>
                          </div>
                        </div>

                        {log.notes && (
                          <div className="text-sm text-gray-600 mb-3">
                            <span className="font-medium">Notizen:</span> {log.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getStatusColor(log.status)}>
                            {getStatusLabel(log.status)}
                          </Badge>
                          {log.approvedBy && (
                            <span className="text-xs text-gray-500">
                              Genehmigt von {log.approvedBy}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {log.status === 'pending' && (
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleApproveHours(log.id)}
                            className="gap-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Genehmigen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectHours(log.id)}
                            className="gap-1"
                          >
                            <XCircle className="h-4 w-4" />
                            Ablehnen
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          <div className="space-y-4">
            {/* Attendance Records List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attendanceRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{record.participantName}</span>
                        </div>
                        <Badge variant="outline" className={getStatusColor(record.status)}>
                          {getStatusLabel(record.status)}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Trainer: {record.trainerName}</div>
                        <div>
                          Datum: {format(parseISO(record.date), 'dd. MMMM yyyy', { locale: de })}
                        </div>
                        {record.checkInTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Check-in: {record.checkInTime}</span>
                          </div>
                        )}
                        {record.checkOutTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Check-out: {record.checkOutTime}</span>
                          </div>
                        )}
                        {record.notes && (
                          <div>
                            <span className="font-medium">Notizen:</span> {record.notes}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2 border-t">
                        <span className="text-xs text-gray-500">
                          Status:{' '}
                          {record.status === 'present'
                            ? 'Anwesend'
                            : record.status === 'absent'
                              ? 'Abwesend'
                              : record.status === 'late'
                                ? 'Verspätet'
                                : 'Entschuldigt'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="summary" className="mt-6">
          <div className="space-y-4">
            {/* Hours Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hoursSummaries.map((summary) => (
                <Card key={summary.trainerId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{summary.trainerName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Gesamtstunden:</span>
                        <span className="text-2xl font-bold text-brand-primary">
                          {summary.totalHours.toFixed(1)}h
                        </span>
                      </div>

                      <div className="space-y-2 pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Training:</span>
                          <span className="font-medium">{summary.trainingHours.toFixed(1)}h</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Vorbereitung:</span>
                          <span className="font-medium">
                            {summary.preparationHours.toFixed(1)}h
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Meetings:</span>
                          <span className="font-medium">{summary.meetingHours.toFixed(1)}h</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Sonstiges:</span>
                          <span className="font-medium">{summary.otherHours.toFixed(1)}h</span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Hourglass className="h-3 w-3" />
                            Ausstehend:
                          </span>
                          <span className="font-medium text-yellow-600">
                            {summary.pendingHours.toFixed(1)}h
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            Genehmigt:
                          </span>
                          <span className="font-medium text-green-600">
                            {summary.approvedHours.toFixed(1)}h
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <XSquare className="h-3 w-3" />
                            Abgelehnt:
                          </span>
                          <span className="font-medium text-red-600">
                            {summary.rejectedHours.toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
