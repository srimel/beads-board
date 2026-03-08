import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface BranchSelectorProps {
  branches: string[]
  current: string
  onSelect: (branch: string) => void
}

export function BranchSelector({ branches, current, onSelect }: BranchSelectorProps) {
  return (
    <Select value={current} onValueChange={onSelect}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map(branch => (
          <SelectItem key={branch} value={branch}>
            {branch}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
