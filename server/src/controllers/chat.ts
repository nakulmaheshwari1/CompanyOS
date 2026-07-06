import { Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { ChannelType, Role } from '@prisma/client';
import { uploadFile } from '../utils/cloudinary';

export async function getChannels(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch channels where user is a member
    const channels = await prisma.channel.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                isActive: true,
                lastActiveAt: true
              }
            }
          }
        },
        task: {
          select: { id: true, title: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format DM names (replace with partner's name)
    const formattedChannels = channels.map(channel => {
      if (channel.type === ChannelType.DM) {
        const otherMember = channel.members.find(m => m.userId !== userId);
        return {
          ...channel,
          name: otherMember ? otherMember.user.name : 'Private Message',
          avatarUrl: otherMember ? otherMember.user.avatarUrl : null
        };
      }
      return channel;
    });

    return res.status(200).json(formattedChannels);
  } catch (error) {
    return next(error);
  }
}

export async function createGroupChannel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, members } = req.body; // members is array of userIds

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Group name is required.' });
    }

    const channel = await prisma.channel.create({
      data: {
        type: ChannelType.GROUP,
        name,
        createdBy: userId
      }
    });

    // Add creator as member
    await prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId
      }
    });

    // Add other members
    const uniqueMembers = Array.from(new Set(members as string[] || []));
    for (const memId of uniqueMembers) {
      if (memId === userId) continue;
      await prisma.channelMember.create({
        data: {
          channelId: channel.id,
          userId: memId
        }
      });
    }

    const fullChannel = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        }
      }
    });

    return res.status(201).json(fullChannel);
  } catch (error) {
    return next(error);
  }
}

export async function startDMChannel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({ message: 'Partner ID is required.' });
    }

    // Check if DM channel already exists between these two users
    const existingDM = await prisma.channel.findFirst({
      where: {
        type: ChannelType.DM,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: partnerId } } }
        ]
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        }
      }
    });

    if (existingDM) {
      return res.status(200).json(existingDM);
    }

    // Create new DM channel
    const channel = await prisma.channel.create({
      data: {
        type: ChannelType.DM
      }
    });

    await prisma.channelMember.create({ data: { channelId: channel.id, userId } });
    await prisma.channelMember.create({ data: { channelId: channel.id, userId: partnerId } });

    const fullChannel = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        }
      }
    });

    return res.status(201).json(fullChannel);
  } catch (error) {
    return next(error);
  }
}

export async function getChannelById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, lastActiveAt: true } }
          }
        },
        task: {
          select: { id: true, title: true }
        }
      }
    });

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found.' });
    }

    // Check membership
    const isMember = channel.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Forbidden. You are not a member of this channel.' });
    }

    // Format DM names
    if (channel.type === ChannelType.DM) {
      const otherMember = channel.members.find(m => m.userId !== userId);
      channel.name = otherMember ? otherMember.user.name : 'Private Message';
      channel.avatarUrl = otherMember ? otherMember.user.avatarUrl : null;
    }

    return res.status(200).json(channel);
  } catch (error) {
    return next(error);
  }
}

export async function getChannelMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { cursor, limit = '50' } = req.query;
    const take = parseInt(limit as string, 10);

    const query: any = {
      where: { channelId: id },
      take: take + 1, // Fetch one extra to determine if there is a next page
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true }
        },
        replies: {
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    };

    if (cursor) {
      query.cursor = { id: cursor as string };
      query.skip = 1;
    }

    const messages = await prisma.message.findMany(query);
    
    let nextCursor: string | undefined = undefined;
    if (messages.length > take) {
      const nextItem = messages.pop(); // Remove extra item
      nextCursor = nextItem?.id;
    }

    // Reverse messages to return chronological order (oldest first)
    messages.reverse();

    return res.status(200).json({
      messages,
      nextCursor
    });
  } catch (error) {
    return next(error);
  }
}

export async function sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { content, parentMessageId } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Validate channel membership
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: id,
          userId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this channel.' });
    }

    // Handle file attachments (req.files)
    const attachments: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files as Express.Multer.File[]) {
        const fileUrl = await uploadFile(file, 'chat_attachments');
        attachments.push(fileUrl);
      }
    }

    const message = await prisma.message.create({
      data: {
        channelId: id,
        senderId: userId,
        content: content || '',
        attachments,
        parentMessageId: parentMessageId || null
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    // Update member lastReadAt
    await prisma.channelMember.update({
      where: { channelId_userId: { channelId: id, userId } },
      data: { lastReadAt: new Date() }
    });

    const io = req.app.get('io');
    if (io) {
      // Emit message to channel room
      io.to(`channel:${id}`).emit('chat:message', { message, channelId: id });
    }

    // Trigger alerts / notifications on mentions
    const mentionRegex = /@(\w+@\w+\.\w+|[a-zA-Z0-9_]+)/g;
    const matches = content?.match(mentionRegex);
    if (matches && io) {
      for (const match of matches) {
        const identifier = match.substring(1);
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { name: { equals: identifier.replace(/_/g, ' '), mode: 'insensitive' } }
            ]
          }
        });

        if (user && user.id !== userId) {
          const notification = await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'CHAT_MENTION',
              title: 'Mentioned in Chat',
              body: `${message.sender.name} mentioned you in a chat channel.`,
              referenceId: id
            }
          });
          io.to(`user:${user.id}`).emit('notification:new', notification);
        }
      }
    }

    return res.status(201).json(message);
  } catch (error) {
    return next(error);
  }
}

export async function editMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { content } = req.body;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ message: 'You can only edit your own messages.' });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: {
        content,
        editedAt: new Date()
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

export async function deleteMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    if (message.senderId !== userId && req.user?.role !== Role.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Permission denied.' });
    }

    await prisma.message.delete({ where: { id } });

    return res.status(200).json({ message: 'Message deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}
