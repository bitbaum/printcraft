'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/hooks/useProjects';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const router = useRouter();
  const createProject = useCreateProject();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createProject.mutate(
      {
        name,
        description: description || undefined,
        scene_description: sceneDescription || undefined,
      },
      {
        onSuccess: (project) => {
          toast.success('Project created');
          router.push(`/project/${project.id}/figures`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto w-full px-4 sm:px-6 md:px-8 py-10 sm:py-16 animate-in-page">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight">New Project</h1>
          <p className="text-muted-foreground mt-2 text-lg font-light">
            Start a new artwork composition
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm text-muted-foreground">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Amphicar Lake Garda"
                className="h-11 bg-transparent border-white/[0.08]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm text-muted-foreground">
                Description (optional)
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this artwork for?"
                rows={2}
                className="bg-transparent border-white/[0.08]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scene" className="text-sm text-muted-foreground">
                Scene Description (optional)
              </Label>
              <Textarea
                id="scene"
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                placeholder="e.g., Lake Garda at golden hour, green hills, Italian villages"
                rows={3}
                className="bg-transparent border-white/[0.08]"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-full px-6"
                disabled={createProject.isPending}
              >
                {createProject.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
