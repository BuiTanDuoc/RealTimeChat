using AutoMapper;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Domain.Entities;

namespace RealTimeChat.Application.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<AppUser, UserDto>()
            .ForMember(d => d.IsOnline, o => o.Ignore())
            .ForMember(d => d.Friendship, o => o.Ignore())
            .ForMember(d => d.FriendRequestId, o => o.Ignore());

        CreateMap<MessageReceipt, ReceiptDto>();

        CreateMap<Message, MessageDto>()
            .ForMember(d => d.SenderName, o => o.MapFrom(s => s.Sender.DisplayName))
            .ForMember(d => d.Type, o => o.MapFrom(s => s.Type.ToString()));
    }
}
