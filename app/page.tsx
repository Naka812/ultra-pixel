"use client";

import React, { useState, useEffect } from 'react';
import { PixelProject } from '@/types';
import { DEFAULT_PALETTE, DEFAULT_BRUSHES } from '@/lib/constants';
import Gallery from '@/components/Gallery';
import Editor from '@/components/Editor';
import { db } from '@/lib/db';

export default function Home() {
  const [projects, setProjects] = useState<PixelProject[]>([]);
  const [activeProject, setActiveProject] = useState<PixelProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const storedProjects = await db.projects.toArray();
        console.log('Loaded projects from DB:', storedProjects);
        const migrated: PixelProject[] = storedProjects.map((p: any) => {
          const projData = p.data || p;
          const proj: PixelProject = {
            ...p,
            ...projData,
            dbId: p.id
          };
          
          if (!proj.brushes && !projData.brushes) {
            proj.brushes = DEFAULT_BRUSHES;
          } else {
            const currentBrushes = proj.brushes || projData.brushes || [];
            const missing = DEFAULT_BRUSHES.filter(db => !currentBrushes.find((b: any) => b.id === db.id));
            if (missing.length > 0) {
              proj.brushes = [...currentBrushes, ...missing];
            }
          }
          return proj;
        });
        setProjects(migrated);
      } catch (e) {
        console.error('Failed to load projects', e);
      }
      setIsLoading(false);
    };

    load();
  }, []);

  const saveProjectToDb = async (project: PixelProject) => {
    if (project.dbId) {
      await db.projects.update(project.dbId, { name: project.name, data: project, lastModified: project.lastModified });
    } else {
      // Try to find the project by its string ID
      const existing = await db.projects.where('data.id').equals(project.id).first();
      
      if (existing) {
        await db.projects.update(existing.id!, { name: project.name, data: project, lastModified: project.lastModified });
        project.dbId = existing.id;
      } else {
        const newId = await db.projects.add({ name: project.name, data: project, createdAt: Date.now() });
        project.dbId = Number(newId);
      }
    }
    const updatedProjects = await db.projects.toArray();
    console.log('Updated projects in DB:', updatedProjects);
    setProjects(updatedProjects.map((p: any) => ({ ...p, ...p.data, dbId: p.id })));
  };

  const handleCreate = async (name: string, width: number, height: number) => {
    const layerId = Math.random().toString(36).substring(7);
    const frameId = Math.random().toString(36).substring(7);
    
    const newProject: PixelProject = {
      id: Math.random().toString(36).substring(7),
      name,
      width,
      height,
      layers: [{
        id: layerId,
        name: 'Layer 1',
        isVisible: true,
        isLocked: false,
        opacity: 1
      }],
      frames: [{
        id: frameId,
        cells: {
          [layerId]: Array(width * height).fill('transparent')
        }
      }],
      palettes: [{ id: 'default', name: 'Default Palette', colors: DEFAULT_PALETTE, isMinimized: false, lockedPaletteIndices: [] }],
      brushes: DEFAULT_BRUSHES,
      stamps: [],
      folders: [],
      lastModified: Date.now()
    };
    
    const newId = await db.projects.add({ name: newProject.name, data: newProject, createdAt: Date.now() });
    const projectWithDbId = { ...newProject, dbId: Number(newId) };
    const updatedProjects = await db.projects.toArray();
    setProjects(updatedProjects.map((p: any) => ({ ...p, ...p.data, dbId: p.id })));
    setActiveProject(projectWithDbId);
  };

  const handleSelect = (project: PixelProject) => {
    setActiveProject(project);
  };

  const handleSave = async (updatedProject: PixelProject) => {
    const now = Date.now();
    const projectWithTime = { ...updatedProject, lastModified: now };
    await saveProjectToDb(projectWithTime);
    setActiveProject(projectWithTime);
  };

  const handleDelete = async (project: PixelProject) => {
    console.log('Attempting to delete project:', project);
    if (project.dbId) {
      await db.projects.delete(project.dbId);
      console.log('Project deleted successfully');
    } else {
      console.log('Project has no dbId, cannot delete');
    }
    const updatedProjects = await db.projects.toArray();
    console.log('Updated projects in DB:', updatedProjects);
    setProjects(updatedProjects.map((p: any) => ({ ...p, ...p.data, dbId: p.id })));
  };

  const handleImport = async (importedProject: PixelProject) => {
    const now = Date.now();
    const projectWithTime = { 
      ...importedProject, 
      lastModified: now,
    };
    
    await saveProjectToDb(projectWithTime);
    const updatedProjects = await db.projects.toArray();
    setProjects(updatedProjects.map((p: any) => ({ ...p, ...p.data, dbId: p.id })));
    setActiveProject(projectWithTime);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (activeProject) {
    return (
      <Editor 
        project={activeProject} 
        onSave={handleSave} 
        onBack={() => setActiveProject(null)} 
      />
    );
  }

  return (
    <Gallery 
      projects={projects} 
      onSelect={handleSelect} 
      onCreate={handleCreate}
      onDelete={handleDelete}
      onImport={handleImport}
    />
  );
}
