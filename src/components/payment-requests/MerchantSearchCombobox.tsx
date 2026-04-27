import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Merchant {
  user_id: string;
  business_name: string | null;
  full_name: string | null;
  email: string | null;
}

interface MerchantSearchComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  onSelectFull?: (userId: string, name: string) => void;
}

const MerchantSearchCombobox: React.FC<MerchantSearchComboboxProps> = ({
  value,
  onValueChange,
  onSelectFull,
}) => {
  const [open, setOpen] = useState(false);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchMerchants();
  }, [user]);

  const fetchMerchants = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, business_name, full_name, email')
        .neq('user_id', user.id);

      if (error) throw error;

      const filteredData = (data || [])
        .filter((profile: any) => profile.business_name || profile.full_name)
        .sort((a: any, b: any) => {
          const nameA = a.business_name || a.full_name || '';
          const nameB = b.business_name || b.full_name || '';
          return nameA.localeCompare(nameB);
        });

      setMerchants(filteredData as Merchant[]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const selectedMerchant = merchants.find((m) => m.user_id === value);
  const displayName = selectedMerchant
    ? selectedMerchant.business_name || selectedMerchant.full_name || 'Unknown'
    : 'Select merchant...';

  // Strict search filtering - only show merchants that contain the search query
  const filteredMerchants = merchants.filter((merchant) => {
    if (!searchQuery.trim()) return true; // Show all if no search query

    const query = searchQuery.toLowerCase();
    const merchantName = (merchant.business_name || merchant.full_name || '').toLowerCase();
    const merchantEmail = (merchant.email || '').toLowerCase();

    // Strict substring match - must contain the query
    return merchantName.includes(query) || merchantEmail.includes(query);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {displayName}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search merchants..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading...' : 'No merchant found.'}
            </CommandEmpty>
            <CommandGroup>
              {filteredMerchants.map((merchant) => {
                const merchantName = merchant.business_name || merchant.full_name || '';
                return (
                  <CommandItem
                    key={merchant.user_id}
                    value={merchant.user_id}
                    onSelect={() => {
                      onValueChange(merchant.user_id);
                      if (onSelectFull) {
                        onSelectFull(merchant.user_id, merchantName);
                      }
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === merchant.user_id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <div className="font-medium">
                        {merchantName}
                      </div>
                      {merchant.email && (
                        <div className="text-sm text-gray-500">{merchant.email}</div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default MerchantSearchCombobox;
