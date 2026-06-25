"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, Snowflake, Plus, Pencil, Trash2, DoorOpen } from "lucide-react";
import type { AccommodationType } from "@/lib/types";

interface Room {
  id: string;
  name: string;
  accommodation_type_id: string;
  is_available: boolean;
  accommodation_type?: AccommodationType;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

export default function AccommodationPage() {
  const { data: accommodationTypes, error: accError } = useSWR<AccommodationType[]>(
    "/api/accommodation",
    fetcher
  );
  const { data: rooms, error: roomsError } = useSWR<Room[]>("/api/rooms", fetcher);

  const [isAccDialogOpen, setIsAccDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<AccommodationType | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Accommodation form state
  const [accForm, setAccForm] = useState({
    name: "",
    type: "dorm",
    description: "",
    has_ac: false,
    price_per_night: 0,
  });

  // Room form state
  const [roomForm, setRoomForm] = useState({
    name: "",
    accommodation_type_id: "",
    is_available: true,
  });

  const resetAccForm = () => {
    setAccForm({
      name: "",
      type: "dorm",
      description: "",
      has_ac: false,
      price_per_night: 0,
    });
    setEditingAcc(null);
  };

  const resetRoomForm = () => {
    setRoomForm({
      name: "",
      accommodation_type_id: "",
      is_available: true,
    });
    setEditingRoom(null);
  };

  const openAccDialog = (acc?: AccommodationType) => {
    if (acc) {
      setEditingAcc(acc);
      setAccForm({
        name: acc.name,
        type: acc.type,
        description: acc.description || "",
        has_ac: acc.has_ac,
        price_per_night: acc.price_per_night,
      });
    } else {
      resetAccForm();
    }
    setIsAccDialogOpen(true);
  };

  const openRoomDialog = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        name: room.name,
        accommodation_type_id: room.accommodation_type_id,
        is_available: room.is_available,
      });
    } else {
      resetRoomForm();
    }
    setIsRoomDialogOpen(true);
  };

  const handleSaveAcc = async () => {
    try {
      if (editingAcc) {
        await fetch(`/api/accommodation/${editingAcc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accForm),
        });
      } else {
        await fetch("/api/accommodation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accForm),
        });
      }
      mutate("/api/accommodation");
      setIsAccDialogOpen(false);
      resetAccForm();
    } catch (err) {
      console.error("Failed to save accommodation:", err);
    }
  };

  const handleDeleteAcc = async (id: string) => {
    if (!confirm("Are you sure you want to delete this accommodation type?")) return;
    try {
      await fetch(`/api/accommodation/${id}`, { method: "DELETE" });
      mutate("/api/accommodation");
      mutate("/api/rooms");
    } catch (err) {
      console.error("Failed to delete accommodation:", err);
    }
  };

  const handleSaveRoom = async () => {
    try {
      if (editingRoom) {
        await fetch(`/api/rooms/${editingRoom.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roomForm),
        });
      } else {
        await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roomForm),
        });
      }
      mutate("/api/rooms");
      setIsRoomDialogOpen(false);
      resetRoomForm();
    } catch (err) {
      console.error("Failed to save room:", err);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm("Are you sure you want to delete this room?")) return;
    try {
      await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      mutate("/api/rooms");
    } catch (err) {
      console.error("Failed to delete room:", err);
    }
  };

  if (accError || roomsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Failed to load data</p>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    dorm: "bg-gray-100 text-gray-800",
    private: "bg-blue-100 text-blue-800",
    suite: "bg-amber-100 text-amber-800",
  };

  return (
    <div className="space-y-6">
      {/* Accommodation Types Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accommodation</h1>
          <p className="text-muted-foreground">Manage accommodation types and rooms</p>
        </div>
        <Button onClick={() => openAccDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Type
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {!accommodationTypes || accommodationTypes.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No accommodation types found</p>
            </CardContent>
          </Card>
        ) : (
          accommodationTypes.map((type) => (
            <Card key={type.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Home className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <Badge variant="outline" className={typeColors[type.type] || ""}>
                        {type.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openAccDialog(type)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAcc(type.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {type.description && (
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                )}
                <div className="flex items-center gap-4">
                  {type.has_ac && (
                    <div className="flex items-center gap-1 text-sm">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      <span>AC</span>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t">
                  <p className="text-2xl font-bold">
                    Rs. {type.price_per_night.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground">/night</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Rooms Section */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div>
          <h2 className="text-xl font-bold text-foreground">Rooms</h2>
          <p className="text-muted-foreground">Manage individual rooms</p>
        </div>
        <Button onClick={() => openRoomDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!rooms || rooms.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No rooms found</p>
            </CardContent>
          </Card>
        ) : (
          rooms.map((room) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <DoorOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{room.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {room.accommodation_type?.name || "Unknown type"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openRoomDialog(room)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <Badge variant={room.is_available ? "default" : "secondary"}>
                    {room.is_available ? "Available" : "Occupied"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Accommodation Type Dialog */}
      <Dialog open={isAccDialogOpen} onOpenChange={setIsAccDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAcc ? "Edit Accommodation Type" : "Add Accommodation Type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={accForm.name}
                onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                placeholder="e.g., Private Room"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select
                value={accForm.type}
                onValueChange={(value) => setAccForm({ ...accForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dorm">Dorm</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="suite">Suite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={accForm.description}
                onChange={(e) => setAccForm({ ...accForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Price per night (Rs.)</label>
              <Input
                type="number"
                value={accForm.price_per_night}
                onChange={(e) =>
                  setAccForm({ ...accForm, price_per_night: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has_ac"
                checked={accForm.has_ac}
                onChange={(e) => setAccForm({ ...accForm, has_ac: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="has_ac" className="text-sm font-medium">
                Has AC
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAcc}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Edit Room" : "Add Room"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Room Name</label>
              <Input
                value={roomForm.name}
                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                placeholder="e.g., Room 101"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Accommodation Type</label>
              <Select
                value={roomForm.accommodation_type_id}
                onValueChange={(value) =>
                  setRoomForm({ ...roomForm, accommodation_type_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accommodationTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_available"
                checked={roomForm.is_available}
                onChange={(e) => setRoomForm({ ...roomForm, is_available: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="is_available" className="text-sm font-medium">
                Available
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoom}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
