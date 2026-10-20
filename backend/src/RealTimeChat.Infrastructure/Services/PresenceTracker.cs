using System.Collections.Concurrent;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.Infrastructure.Services;

public class PresenceTracker : IPresenceTracker
{
    private readonly ConcurrentDictionary<Guid, HashSet<string>> _connections = new();

    public bool UserConnected(Guid userId, string connectionId)
    {
        lock (_connections)
        {
            var set = _connections.GetOrAdd(userId, _ => new HashSet<string>());
            set.Add(connectionId);
            return set.Count == 1;
        }
    }

    public bool UserDisconnected(Guid userId, string connectionId)
    {
        lock (_connections)
        {
            if (!_connections.TryGetValue(userId, out var set)) return false;
            set.Remove(connectionId);
            if (set.Count > 0) return false;
            _connections.TryRemove(userId, out _);
            return true;
        }
    }

    public bool IsOnline(Guid userId) => _connections.ContainsKey(userId);

    public IReadOnlyList<Guid> OnlineUserIds() => _connections.Keys.ToList();
}
