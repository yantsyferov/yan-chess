import { Injectable, NotFoundException } from "@nestjs/common";
import { Mode, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface RatingDto {
  mode: Mode;
  rating: number;
  gamesPlayed: number;
}

export interface UserMeDto {
  id: string;
  nickname: string;
  email: string;
  createdAt: Date;
  avatar: null;
  ratings: RatingDto[];
}

const MODE_ORDER: Mode[] = [Mode.Bullet, Mode.Blitz, Mode.Rapid, Mode.Classical];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureStartingRatings(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.ratingByMode.createMany({
      data: [
        { userId, mode: Mode.Bullet,    rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0 },
        { userId, mode: Mode.Blitz,     rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0 },
        { userId, mode: Mode.Rapid,     rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0 },
        { userId, mode: Mode.Classical, rating: 1500, rd: 350, volatility: 0.06, gamesPlayed: 0 },
      ],
      skipDuplicates: true,
    });
  }

  async me(userId: string): Promise<UserMeDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { ratings: true },
    });
    if (!user) throw new NotFoundException();

    const byMode = new Map(user.ratings.map((r) => [r.mode, r]));
    const ratings: RatingDto[] = MODE_ORDER
      .map((m) => byMode.get(m))
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
      .map((r) => ({ mode: r.mode, rating: r.rating, gamesPlayed: r.gamesPlayed }));

    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      createdAt: user.createdAt,
      avatar: null,
      ratings,
    };
  }
}
