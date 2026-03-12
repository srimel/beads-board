import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const LS_KEY = 'beads-board-terminal-font-family'
const DEFAULT_PLACEHOLDER = 'Menlo, Monaco, "Courier New", monospace'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onSave: (settings: { fontFamily: string }) => void
}

export function SettingsModal({ open, onClose, onSave }: SettingsModalProps) {
  const [fontFamily, setFontFamily] = useState('')

  // Read current value when modal opens
  useEffect(() => {
    if (open) {
      setFontFamily(localStorage.getItem(LS_KEY) || '')
    }
  }, [open])

  const handleSave = () => {
    localStorage.setItem(LS_KEY, fontFamily)
    onSave({ fontFamily })
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Configure application settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Terminal
            </h3>
            <div className="space-y-2">
              <Label htmlFor="font-family">Font Family</Label>
              <Input
                id="font-family"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                placeholder={DEFAULT_PLACEHOLDER}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="bg-primary/80 text-primary-foreground hover:bg-primary" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
