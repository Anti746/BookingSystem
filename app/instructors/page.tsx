"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, User, Mail, Phone, Users } from "lucide-react";
import type { Instructor } from "@/lib/types";

type InstructorFormData = {
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  max_students_per_session: number;
};

const emptyForm: InstructorFormData = {
  name: "",
  email: "",
  phone: "",
  is_active: true,
  max_students_per_session: 4,
};

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [formData, setFormData] = useState<InstructorFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchInstructors = async () => {
    try {
      const res = await fetch("/api/instructors");
      if (!res.ok) throw new Error("Failed to fetch instructors");
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      setInstructors(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading instructors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructors();
  }, []);

  const openCreateModal = () => {
    setEditingInstructor(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setFormData({
      name: instructor.name,
      email: instructor.email || "",
      phone: instructor.phone || "",
      is_active: instructor.is_active,
      max_students_per_session: instructor.max_students_per_session,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = editingInstructor
        ? `/api/instructors/${editingInstructor.id}`
        : "/api/instructors";
      const method = editingInstructor ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        throw new Error(data.error || "Failed to save instructor");
      }

      setIsModalOpen(false);
      setSuccessMessage(
        editingInstructor
          ? "Instructor updated successfully"
          : "Instructor created successfully"
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchInstructors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving instructor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this instructor?")) return;

    try {
      const res = await fetch(`/api/instructors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete instructor");

      setSuccessMessage("Instructor deleted successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchInstructors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting instructor");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading instructors...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instructors</h1>
          <p className="text-muted-foreground">
            Manage surf instructors and their availability
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Instructor
        </Button>
      </div>

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button className="ml-4 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Instructors</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Max Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No instructors found
                  </TableCell>
                </TableRow>
              ) : (
                instructors.map((instructor) => (
                  <TableRow key={instructor.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="font-medium">{instructor.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {instructor.email ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {instructor.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {instructor.phone ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {instructor.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {instructor.max_students_per_session}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={instructor.is_active ? "default" : "secondary"}
                      >
                        {instructor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(instructor)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(instructor.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingInstructor ? "Edit Instructor" : "Add New Instructor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Instructor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="instructor@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+351 912 345 678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_students">Max Students per Session</Label>
              <Input
                id="max_students"
                type="number"
                value={formData.max_students_per_session}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_students_per_session: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingInstructor ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
