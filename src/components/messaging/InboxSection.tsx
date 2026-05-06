import React, { useState, useEffect, useRef } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import MerchantSearchCombobox from '@/components/payment-requests/MerchantSearchCombobox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PendingApprovalModal from '@/components/ui/PendingApprovalModal';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Send, MessageSquare, ArrowLeft, CheckCheck,
  PenSquare, Smile, Loader2, Coins, Check, X,
} from 'lucide-react';

// ── Emoji list ────────────────────────────────────────────────────────────────
const EMOJIS = [
  '😀','😂','😊','😍','🥰','😎','🤔','😅','😭','🤣','😢','😠','😱','🥳','🤗',
  '❤️','🧡','💛','💚','💙','💜','💯','🔥','⭐','✅','⚡','🎉','🎊','🚀','🎯',
  '👍','👎','👏','🙌','🤝','🙏','💪','✌️','🤞','👋','🫶','💋','💔','💘','💝',
  '🍕','🍔','☕','🎵','🎮','📱','💻','📸','🏆','💡','🌟','🌈','🌙','☀️','🌊',
];

// ── Avatar ────────────────────────────────────────────────────────────────────
const PALETTE = [
  '#7C3AED','#2563EB','#059669','#DC2626','#D97706',
  '#0891B2','#7C3AED','#BE185D','#0D9488','#4338CA',
];
const getColor = (name: string) => {
  const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[h % PALETTE.length];
};
const getInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const Av = ({ name, size = 40 }: { name: string; size?: number }) => (
  <div
    className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
    style={{ width: size, height: size, fontSize: size * 0.35, background: getColor(name) }}
  >
    {getInitials(name)}
  </div>
);

// ── Time helpers ─────────────────────────────────────────────────────────────
const convTime = (d: string) => {
  const dt = new Date(d);
  if (isToday(dt)) return format(dt, 'h:mm a');
  if (isYesterday(dt)) return 'Yesterday';
  return format(dt, 'dd/MM/yy');
};
const dateSep = (d: string) => {
  const dt = new Date(d);
  if (isToday(dt)) return 'Today';
  if (isYesterday(dt)) return 'Yesterday';
  return format(dt, 'MMMM d, yyyy');
};

interface TradeRequest {
  serviceName: string;
  barterPercentage: number;
}

interface InboxSectionProps {
  variant?: 'embedded' | 'page';
  initialRecipientId?: string;
  initialRecipientName?: string;
  tradeRequest?: TradeRequest;
}

// ── WhatsApp chat background (SVG data URI) ───────────────────────────────────
const WA_BG = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

const InboxSection: React.FC<InboxSectionProps> = ({
  variant = 'embedded',
  initialRecipientId,
  initialRecipientName,
  tradeRequest,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { conversations, messages, loading, fetchMessages, sendMessage } = useMessages();
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // New conversation dialog
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvUserId, setNewConvUserId] = useState('');

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tradeRequestSentRef = useRef(false);

  const selectedConv = conversations.find((c) => c.recipient_id === selectedId);
  const displayName = selectedName || selectedConv?.recipient_name || 'Unknown';

  // Auto-open conversation when coming from service listing
  useEffect(() => {
    if (initialRecipientId && !loading) {
      openConv(initialRecipientId, initialRecipientName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecipientId, loading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConv = (id: string, name?: string) => {
    setSelectedId(id);
    setSelectedName(name || null);
    setShowChat(true);
    fetchMessages(id);
    setText('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleStartNew = (userId: string, name: string) => {
    setNewConvOpen(false);
    setNewConvUserId('');
    openConv(userId, name);
  };

  const handleSend = async () => {
    if (!text.trim() || !selectedId || sending) return;
    const { data: biz } = await supabase.from('businesses').select('status').eq('user_id', user!.id).maybeSingle();
    if (biz?.status === 'pending') {
      setPendingModalOpen(true);
      return;
    }
    setSending(true);
    await sendMessage(selectedId, text.trim());
    setText('');
    setSending(false);
    inputRef.current?.focus();
  };

  const handleSendTradeRequest = async () => {
    if (!selectedId || !tradeRequest || tradeRequestSentRef.current) return;
    const { data: biz } = await supabase.from('businesses').select('status').eq('user_id', user!.id).maybeSingle();
    if (biz?.status === 'pending') {
      setPendingModalOpen(true);
      return;
    }
    setSending(true);
    tradeRequestSentRef.current = true;

    // Save to trade_requests table
    const { error } = await supabase.from('trade_requests').insert({
      sender_id: user?.id,
      merchant_id: selectedId,
      service_name: tradeRequest.serviceName,
      barter_percentage: tradeRequest.barterPercentage,
    }).select().single();

    if (error) {
      tradeRequestSentRef.current = false;
      setSending(false);
      toast({ title: 'Failed to send trade request', description: error.message, variant: 'destructive' });
      return;
    }

    // Trigger handles the notification automatically
    await sendMessage(selectedId, `Hi! I've sent a trade request for "${tradeRequest.serviceName}". Please check your notifications to accept or decline.`);
    setSending(false);
  };

  const handleTradeResponse = async (msg: any, accepted: boolean) => {
    let parsed: any = {};
    try { parsed = JSON.parse(msg.content); } catch { return; }

    const { error: msgErr } = await supabase.from('messages').update({ content: JSON.stringify({ ...parsed, status: accepted ? 'accepted' : 'rejected' }) }).eq('id', msg.id);
    if (msgErr) { toast({ title: 'Failed to update trade status', description: msgErr.message, variant: 'destructive' }); return; }

    const notifUserId = parsed.senderId;
    if (notifUserId) {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: notifUserId,
        title: accepted ? 'Trade Request Accepted!' : 'Trade Request Declined',
        message: accepted
          ? `${displayName} accepted your request for "${parsed.service}". You can now discuss details.`
          : `${displayName} declined your request for "${parsed.service}".`,
        type: accepted ? 'success' : 'info',
      });
      if (notifErr) console.error('Failed to notify trade requester:', notifErr.message);
    }
  };

  const filteredConvs = search.trim()
    ? conversations.filter((c) =>
        c.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_message.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const chatMessages = messages.filter(
    (m) =>
      (m.sender_id === selectedId && m.recipient_id === user?.id) ||
      (m.sender_id === user?.id && m.recipient_id === selectedId)
  );

  // Group by date
  const groups: { date: string; msgs: typeof chatMessages }[] = [];
  chatMessages.forEach((m) => {
    const key = format(new Date(m.created_at), 'yyyy-MM-dd');
    const g = groups.find((x) => x.date === key);
    if (g) g.msgs.push(m);
    else groups.push({ date: key, msgs: [m] });
  });

  const h = variant === 'page' ? 'calc(100vh - 72px)' : 'calc(100vh - 200px)';

  return (
    <>
      <PendingApprovalModal open={pendingModalOpen} onClose={() => setPendingModalOpen(false)} />
      <div
        className="flex overflow-hidden rounded-2xl shadow-2xl border border-gray-200"
        style={{ height: h, minHeight: 520 }}
      >
        {/* ══════════════ LEFT SIDEBAR ══════════════ */}
        <div
          className={`${showChat ? 'hidden md:flex' : 'flex'} flex-col bg-white border-r border-gray-200`}
          style={{ width: 340, flexShrink: 0 }}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5]">
            <div className="flex items-center gap-3">
              {user && <Av name={user.email || 'Me'} size={40} />}
              <span className="font-semibold text-gray-800 text-sm">Chats</span>
            </div>
          </div>

          {/* Search — same combobox as barter send/request */}
          <div className="px-3 py-2 bg-white border-b border-gray-100">
            <MerchantSearchCombobox
              value=""
              onValueChange={() => {}}
              onSelectFull={(userId, name) => {
                openConv(userId, name);
                setNewConvOpen(false);
              }}
            />
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1 bg-white">
            {loading ? (
              <div className="space-y-0">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-gray-50">
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#f0f2f5] flex items-center justify-center mb-3">
                  <MessageSquare className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No chats yet</p>
                <p className="text-xs text-gray-400 mt-1">Click the pencil icon to start chatting</p>
              </div>
            ) : (
              <div>
                {filteredConvs.map((conv, idx) => {
                  const isActive = selectedId === conv.recipient_id;
                  return (
                    <button
                      key={conv.recipient_id}
                      onClick={() => openConv(conv.recipient_id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors relative ${
                        isActive ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                      }`}
                    >
                      {/* Divider between items (not first) */}
                      {idx > 0 && (
                        <div className="absolute top-0 left-[72px] right-0 h-px bg-gray-100" />
                      )}
                      <Av name={conv.recipient_name} size={48} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-0.5">
                          <span className="font-medium text-[15px] text-gray-900 truncate flex-1 mr-2">
                            {conv.recipient_name}
                          </span>
                          <span className={`text-[11px] flex-shrink-0 ${conv.unread_count > 0 ? 'text-[#059669] font-semibold' : 'text-gray-400'}`}>
                            {convTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[13px] truncate flex-1 ${conv.unread_count > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                            {conv.last_message}
                          </p>
                          {conv.unread_count > 0 && (
                            <span className="flex-shrink-0 min-w-[20px] h-5 bg-[#059669] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ══════════════ RIGHT: CHAT ══════════════ */}
        <div className={`${!showChat ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-w-0`}>
          {!selectedId ? (
            /* Empty state — WhatsApp style */
            <div
              className="flex-1 flex flex-col items-center justify-center select-none"
              style={{ background: '#f0f2f5', backgroundImage: WA_BG }}
            >
              <div className="flex flex-col items-center text-center max-w-sm px-6">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
                  style={{ background: '#059669' }}
                >
                  <MessageSquare className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-2xl font-light text-gray-700 mb-2">Valuehub Exchange Web</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Send and receive messages to connect with other members.
                </p>
                <button
                  onClick={() => setNewConvOpen(true)}
                  className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: '#059669' }}
                >
                  <PenSquare className="h-4 w-4" />
                  New Chat
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Chat header ── */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] border-b border-gray-200 flex-shrink-0">
                <button
                  className="md:hidden p-1 rounded-full hover:bg-gray-200 text-gray-600 transition-colors mr-1"
                  onClick={() => { setShowChat(false); setSelectedName(null); }}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Av name={displayName} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] text-gray-900 truncate">{displayName}</p>
                  <p className="text-[12px] text-[#059669]">online</p>
                </div>
              </div>

              {/* ── Messages ── */}
              <div
                className="flex-1 overflow-y-auto px-[5%] py-4 space-y-1"
                style={{
                  background: '#efeae2',
                  backgroundImage: WA_BG,
                }}
              >
                {chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="bg-[#fffbeb] text-[#9b7e3c] text-[13px] px-4 py-2 rounded-lg shadow-sm font-medium">
                      🔒 Messages are end-to-end secured. Say hi!
                    </div>
                  </div>
                ) : (
                  <>
                    {groups.map((group) => (
                      <div key={group.date}>
                        {/* Date pill */}
                        <div className="flex justify-center my-3">
                          <span className="bg-white text-gray-500 text-[12px] font-medium px-3 py-1 rounded-full shadow-sm">
                            {dateSep(group.date + 'T00:00:00')}
                          </span>
                        </div>

                        {group.msgs.map((msg, i) => {
                          const isMine = msg.sender_id === user?.id;
                          const prev = group.msgs[i - 1];
                          const next = group.msgs[i + 1];
                          const isFirst = !prev || prev.sender_id !== msg.sender_id;
                          const isLast = !next || next.sender_id !== msg.sender_id;
                          const gap = !isLast ? 'mb-0.5' : 'mb-1.5';

                          // ── System / trade-request card ──────────────────
                          if (msg.message_type === 'system') {
                            let parsed: any = {};
                            try { parsed = JSON.parse(msg.content); } catch { /* skip */ }
                            if (parsed.type === 'trade_request') {
                              const status: string | undefined = parsed.status;
                              const isRecipient = msg.recipient_id === user?.id;
                              return (
                                <div key={msg.id} className="flex justify-center my-3">
                                  <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-4 w-72 max-w-[90%]">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                                        <Coins className="h-4 w-4 text-violet-600" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Trade Request</p>
                                        <p className="text-[11px] text-gray-400">{format(new Date(msg.created_at), 'h:mm a')}</p>
                                      </div>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 mb-1">{parsed.service}</p>
                                    <p className="text-xs text-gray-500 mb-3">
                                      {parsed.barter}% Valuehub Exchange Credits + {100 - (parsed.barter ?? 0)}% Cash
                                    </p>
                                    {!status && isRecipient && (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleTradeResponse(msg, true)}
                                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                                        >
                                          <Check className="h-3.5 w-3.5" /> Accept
                                        </button>
                                        <button
                                          onClick={() => handleTradeResponse(msg, false)}
                                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                                        >
                                          <X className="h-3.5 w-3.5" /> Decline
                                        </button>
                                      </div>
                                    )}
                                    {status === 'accepted' && (
                                      <div className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                                        <Check className="h-3.5 w-3.5" /> Accepted
                                      </div>
                                    )}
                                    {status === 'rejected' && (
                                      <div className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-gray-50 text-gray-500 text-xs font-bold">
                                        <X className="h-3.5 w-3.5" /> Declined
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          }

                          // ── Normal text bubble ───────────────────────────
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${gap}`}
                            >
                              <div
                                className="relative max-w-[65%] md:max-w-[55%] px-3 pt-1.5 pb-1 shadow-sm"
                                style={{
                                  background: isMine ? '#dcf8c6' : '#ffffff',
                                  borderRadius: isMine
                                    ? isFirst
                                      ? '12px 0px 12px 12px'
                                      : isLast
                                      ? '12px 12px 0px 12px'
                                      : '12px 12px 12px 12px'
                                    : isFirst
                                    ? '0px 12px 12px 12px'
                                    : isLast
                                    ? '12px 12px 12px 0px'
                                    : '12px 12px 12px 12px',
                                }}
                              >
                                {/* WhatsApp tail — only on first message in run */}
                                {isFirst && (
                                  <div
                                    className="absolute top-0"
                                    style={
                                      isMine
                                        ? {
                                            right: -8,
                                            width: 0,
                                            height: 0,
                                            borderLeft: '8px solid #dcf8c6',
                                            borderBottom: '8px solid transparent',
                                          }
                                        : {
                                            left: -8,
                                            width: 0,
                                            height: 0,
                                            borderRight: '8px solid #ffffff',
                                            borderBottom: '8px solid transparent',
                                          }
                                    }
                                  />
                                )}

                                <p className="text-[14.5px] text-gray-900 leading-[1.45] break-words pr-10">
                                  {msg.content}
                                </p>

                                {/* Timestamp + read receipt inside bubble */}
                                <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
                                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                    {format(new Date(msg.created_at), 'h:mm a')}
                                  </span>
                                  {isMine && (
                                    <CheckCheck
                                      className={`h-4 w-4 flex-shrink-0 ${msg.read ? 'text-[#53bdeb]' : 'text-gray-400'}`}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* ── Trade request banner ── */}
              {tradeRequest && selectedId && !tradeRequestSentRef.current && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-violet-50 border-t border-violet-100 flex-shrink-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-violet-700 truncate">Service: {tradeRequest.serviceName}</p>
                    <p className="text-[11px] text-violet-500">{tradeRequest.barterPercentage}% credits + {100 - tradeRequest.barterPercentage}% cash</p>
                  </div>
                  <button
                    onClick={handleSendTradeRequest}
                    disabled={sending}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors disabled:opacity-60"
                  >
                    <Coins className="h-3.5 w-3.5" />
                    Send Trade Request
                  </button>
                </div>
              )}

              {/* ── Input bar ── */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f2f5] border-t border-gray-200 flex-shrink-0">
                {/* Emoji */}
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <button className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0">
                      <Smile className="h-6 w-6" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start" side="top">
                    <div className="grid grid-cols-10 gap-0.5">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setText((prev) => prev + emoji);
                            setEmojiOpen(false);
                            inputRef.current?.focus();
                          }}
                          className="w-7 h-7 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Text input */}
                <Input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message"
                  className="flex-1 rounded-full bg-white border-0 text-[15px] px-5 h-11 focus-visible:ring-0 shadow-sm"
                  disabled={sending}
                />

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                  style={{ background: '#059669' }}
                >
                  {sending
                    ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                    : <Send className="h-5 w-5 text-white" style={{ transform: 'translateX(1px)' }} />
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════ New Conversation Dialog ══════════════ */}
      <Dialog open={newConvOpen} onOpenChange={(open) => { setNewConvOpen(open); if (!open) setNewConvUserId(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <MerchantSearchCombobox
              value={newConvUserId}
              onValueChange={setNewConvUserId}
              onSelectFull={(userId, name) => handleStartNew(userId, name)}
            />
            <p className="text-xs text-gray-400 text-center">Select a member to open a chat</p>
          </div>
          {/* dead code below kept to satisfy JSX structure — remove old block */}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InboxSection;
