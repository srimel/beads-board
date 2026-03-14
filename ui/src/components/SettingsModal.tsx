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

const LS_FONT_FAMILY = 'beads-board-terminal-font-family'
const LS_FONT_SIZE = 'beads-board-terminal-font-size'
const DEFAULT_FONT_PLACEHOLDER = 'Menlo, Monaco, "Courier New", monospace'
const DEFAULT_FONT_SIZE = 13

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onSave: (settings: { fontFamily: string; fontSize: number }) => void
}

export function SettingsModal({ open, onClose, onSave }: SettingsModalProps) {
  const [fontFamily, setFontFamily] = useState('')
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)

  // Read current values when modal opens
  useEffect(() => {
    if (open) {
      setFontFamily(localStorage.getItem(LS_FONT_FAMILY) || '')
      const savedSize = localStorage.getItem(LS_FONT_SIZE)
      setFontSize(savedSize ? Number(savedSize) : DEFAULT_FONT_SIZE)
    }
  }, [open])

  const handleSave = () => {
    localStorage.setItem(LS_FONT_FAMILY, fontFamily)
    localStorage.setItem(LS_FONT_SIZE, String(fontSize))
    onSave({ fontFamily, fontSize })
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
                placeholder={DEFAULT_FONT_PLACEHOLDER}
              />
            </div>
            <div className="space-y-2 mt-4">
              <Label htmlFor="font-size">Font Size</Label>
              <Input
                id="font-size"
                type="number"
                min={8}
                max={32}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value) || DEFAULT_FONT_SIZE)}
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
